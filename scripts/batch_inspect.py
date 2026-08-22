import subprocess, json, time, sys, os

urls_file = r"C:\Users\matte\AppData\Local\Temp\opencode\batch_urls.txt"
script = r"C:\Users\matte\.agents\skills\seo\scripts\gsc_inspect.py"
out_file = r"C:\Users\matte\AppData\Local\Temp\opencode\gsc_inspect_results.json"
script_dir = os.path.dirname(script)

with open(urls_file) as f:
    urls = [line.strip() for line in f if line.strip()]

results = []
errors = []

for i, url in enumerate(urls):
    print(f"[{i+1}/{len(urls)}] {url.split('/')[-1][:50]}", file=sys.stderr)
    try:
        proc = subprocess.run(
            [sys.executable, script, url, "--json"],
            capture_output=True, text=True, timeout=30,
            cwd=script_dir
        )
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        if proc.returncode == 0 and stdout:
            data = json.loads(stdout)
            results.append(data)
            verdict = data.get("verdict", "?")
            coverage = data.get("index_status", {}).get("coverage_state", "?")
            print(f"  -> {verdict}: {coverage}", file=sys.stderr)
        else:
            errors.append({"url": url, "error": stderr[:300] if stderr else "empty output"})
            print(f"  -> ERROR: {stderr[:100]}", file=sys.stderr)
    except subprocess.TimeoutExpired:
        errors.append({"url": url, "error": "timeout"})
        print(f"  -> TIMEOUT", file=sys.stderr)
    except Exception as e:
        errors.append({"url": url, "error": str(e)[:200]})
        print(f"  -> EXCEPTION: {e}", file=sys.stderr)
    
    time.sleep(1.5)

output = {"results": results, "errors": errors, "total": len(urls), "inspected": len(results), "failed": len(errors)}
with open(out_file, "w") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nDone: {len(results)}/{len(urls)} inspected, {len(errors)} errors", file=sys.stderr)
print(json.dumps({"inspected": len(results), "errors": len(errors), "total": len(urls)}))

import json
from src.lib.homeSsr import ALL_SEO_PAGES

urls = ["https://legalhelp.cl/"] + [f"https://legalhelp.cl/{p['slug']}" for p in ALL_SEO_PAGES]
with open("C:\\Users\\matte\\AppData\\Local\\Temp\\opencode\\batch_urls.txt", "w") as f:
    f.write("\n".join(urls))
print(f"Generated {len(urls)} URLs")

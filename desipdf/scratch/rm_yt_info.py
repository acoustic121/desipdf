with open("pages/api/video/info.js", "r") as f:
    lines = f.readlines()

out = []
skip = False
for i, line in enumerate(lines):
    if "if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'" in line:
        continue
    if "function extractYouTubeId(url) {" in line:
        skip = True
    
    if skip and "function fetchWithYtDlp(url, platform) {" in line:
        skip = False
        
    if "Supported: YouTube," in line:
        line = line.replace("Supported: YouTube, ", "Supported: ")
    
    if "case 'youtube':   result = await fetchYouTube(url);   break" in line:
        continue
        
    if not skip:
        out.append(line)

with open("pages/api/video/info.js", "w") as f:
    f.writelines(out)

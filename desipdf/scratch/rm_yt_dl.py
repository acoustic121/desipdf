import re

with open("pages/api/video/download.js", "r") as f:
    content = f.read()

# Remove youtubeiInit block
content = re.sub(r'let youtubeiPromise = null\nasync function initYoutubei\(\) \{[\s\S]*?\n\}\n', '', content)

# Remove extractYouTubeId block
content = re.sub(r'function extractYouTubeId\(url\) \{[\s\S]*?\n\}\n', '', content)

# Remove getYouTubeIStream block
content = re.sub(r'async function getYouTubeIStream\(url\) \{[\s\S]*?\n\}\n', '', content)

# Remove the whole "if (platform === 'youtube' && videoUrl) {" block inside handler
# It goes from "if (platform === 'youtube' && videoUrl) {" to the end of the block right before "if (directUrl) {"
# Let's find it.
start = content.find("if (platform === 'youtube' && videoUrl) {")
if start != -1:
    end = content.find("// ── Direct Download Proxy", start)
    if end != -1:
        # Also remove the "// ── YouTube ──" comment
        pre_start = content.rfind("// ── YouTube", 0, start)
        if pre_start != -1:
            start = pre_start
        content = content[:start] + content[end:]

with open("pages/api/video/download.js", "w") as f:
    f.write(content)


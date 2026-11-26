import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("Usage: python integrate.py input-worker.mjs output-worker.mjs")
source, target = map(Path, sys.argv[1:])
root = Path(__file__).resolve().parent
base = source.read_text(encoding="utf-8-sig")
marker = "export default v222Extras;"
if base.count(marker) != 1:
    raise SystemExit("Expected one v222Extras export from the verified Worker 246 code")
scripts = {
    "board": (root / "board.js").read_text(encoding="utf-8-sig"),
    "guardian": (root / "guardian-ui.js").read_text(encoding="utf-8-sig"),
}
binding = """
import { createV12Worker } from './worker-overlay.mjs';
export default createV12Worker(v222Extras, {
  currentMember, requireMember, readJson, adminAccess: v222RequireAdmin,
  scrub: hidePhoneText, hosts: ['yukvinc.com.tr']
}, %s);
""" % json.dumps(scripts, ensure_ascii=False)
target.write_text(base.replace(marker, binding), encoding="utf-8")

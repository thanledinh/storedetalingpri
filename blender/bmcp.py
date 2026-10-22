"""Gửi lệnh tới addon "MCP for Blender" đang mở (127.0.0.1:9876).

Cách dùng:
  python blender/bmcp.py info                 # xem cảnh hiện tại
  python blender/bmcp.py run <file.py>        # chạy một script Python trong Blender
  python blender/bmcp.py code "<python>"      # chạy một đoạn code ngắn
"""
import json, socket, sys

HOST, PORT = "127.0.0.1", 9876


def send(cmd, params=None, timeout=1800):
    with socket.create_connection((HOST, PORT), timeout=timeout) as s:
        s.sendall(json.dumps({"type": cmd, "params": params or {}}).encode("utf-8"))
        buf = b""
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
            try:
                return json.loads(buf.decode("utf-8"))
            except ValueError:
                continue
    return json.loads(buf.decode("utf-8"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    what = sys.argv[1]
    if what == "info":
        res = send("get_scene_info")
    elif what == "run":
        res = send("execute_code", {"code": open(sys.argv[2], encoding="utf-8").read()})
    else:
        res = send("execute_code", {"code": sys.argv[2]})
    print(json.dumps(res, ensure_ascii=False, indent=1)[:20000])

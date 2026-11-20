import subprocess,pty,fcntl,termios,struct,os,select,time,json
from pathlib import Path
master,slave=pty.openpty();fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',24,80,0,0))
proc=subprocess.Popen(['node','src/index.js'],cwd='tetris/tetris-003-reviewed',stdin=subprocess.DEVNULL,stdout=slave,stderr=slave);raw=b'';deadline=time.monotonic()+5
while time.monotonic()<deadline:
 ready,_,_=select.select([master],[],[],.1)
 if ready:raw+=os.read(master,65536)
 elif proc.poll() is not None:break
if proc.poll() is None:proc.terminate()
status=proc.wait(timeout=3);os.close(master);os.close(slave)
result={'command':'node src/index.js < /dev/null (stdout is an 80x24 PTY)','exitCode':status,'hidesCursor':b'\x1b[?25l' in raw,'restoresCursor':b'\x1b[?25h' in raw,'passed':status==0 and b'\x1b[?25l' not in raw,'outputBytes':len(raw)}
(Path(__file__).parent/'mixed-tty-check.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
assert result['passed']

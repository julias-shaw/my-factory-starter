"""Capture npm start in an 80x24 PTY; emulate the cursor operations used by these games."""
import os,pty,subprocess,fcntl,termios,struct,time,select,json,re,sys,signal,unicodedata,codecs
from pathlib import Path
class Screen:
 def __init__(self):self.rows=[' '*80 for _ in range(24)];self.x=0;self.y=0;self.pending='';self.unknown=set();self.bg=False
 def feed(self,text):
  text=self.pending+text;self.pending='';i=0
  while i<len(text):
   c=text[i]
   if c=='\x1b':
    match=re.match(r'\x1b\[([0-9;?]*)([ -/]*)([@-~])',text[i:])
    if not match:self.pending=text[i:];break
    arg,_,cmd=match.groups();nums=[int(n) if n else 0 for n in arg.lstrip('?').split(';')];n=nums[0] or 1
    if cmd in ['H','f']:self.y=min(23,max(0,n-1));self.x=min(79,max(0,(nums[1] if len(nums)>1 and nums[1] else 1)-1))
    elif cmd=='J' and nums[0] in [2,3]:self.rows=[' '*80 for _ in range(24)]
    elif cmd=='K':
     row=self.rows[self.y];self.rows[self.y]=row[:self.x]+' '*(80-self.x)
    elif cmd=='A':self.y=max(0,self.y-n)
    elif cmd=='B':self.y=min(23,self.y+n)
    elif cmd=='C':self.x=min(79,self.x+n)
    elif cmd=='D':self.x=max(0,self.x-n)
    elif cmd=='G':self.x=min(79,n-1)
    elif cmd=='m':
     for code in nums:
      if code in [0,49]:self.bg=False
      elif 40<=code<=47:self.bg=True
    elif cmd in ['h','l']:pass
    else:self.unknown.add(match.group(0))
    i+=len(match.group(0));continue
   if c=='\r':self.x=0
   elif c=='\n':self.y+=1
   elif c=='\b':self.x=max(0,self.x-1)
   elif ord(c)>=32:
    width=2 if unicodedata.east_asian_width(c) in ['W','F'] else 1
    if self.x>=80:self.x=0;self.y+=1
    if self.y>=24:self.rows.pop(0);self.rows.append(' '*80);self.y=23
    row=self.rows[self.y];visible='█' if self.bg and c==' ' else c;self.rows[self.y]=row[:self.x]+visible+(' ' if width==2 else '')+row[self.x+width:];self.x+=width
   if self.y>=24:self.rows.pop(0);self.rows.append(' '*80);self.y=23
   i+=1
 def snapshot(self):return '\n'.join(r.rstrip() for r in self.rows)
def capture(target):
 master,slave=pty.openpty();fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',24,80,0,0));before=termios.tcgetattr(slave)
 proc=subprocess.Popen(['npm','--prefix',target,'start'],stdin=slave,stdout=slave,stderr=slave,start_new_session=True)
 screen=Screen();decoder=codecs.getincrementaldecoder('utf-8')(errors='replace');raw=[]
 def read_for(seconds):
  end=time.monotonic()+seconds
  while time.monotonic()<end:
   ready,_,_=select.select([master],[],[],min(0.1,max(0,end-time.monotonic())))
   if ready:
    try:chunk=os.read(master,65536)
    except OSError:break
    if not chunk:break
    raw.append(chunk);screen.feed(decoder.decode(chunk))
 read_for(2);normal=screen.snapshot();os.write(master,b'p');read_for(.4);paused=screen.snapshot();os.write(master,b'q');read_for(.4)
 try:status=proc.wait(timeout=5)
 except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGTERM);status=proc.wait(timeout=3)
 after=termios.tcgetattr(slave);os.close(master);os.close(slave)
 return {'target':target,'exitCode':status,'canonicalRestored':bool(before[3]&termios.ICANON)==bool(after[3]&termios.ICANON),'echoRestored':bool(before[3]&termios.ECHO)==bool(after[3]&termios.ECHO),'normal':normal,'paused':paused,'unhandledSequences':sorted(screen.unknown)},b''.join(raw)
if __name__=='__main__':
 target,label=sys.argv[1:];out=Path(__file__).parent;data,raw=capture(target)
 (out/(label+'-terminal.json')).write_text(json.dumps(data,indent=2)+'\n');(out/(label+'-terminal.txt')).write_text(data['normal']+'\n');(out/(label+'-terminal.raw')).write_bytes(raw)
 print(json.dumps({k:v for k,v in data.items() if k not in ['normal','paused']}))

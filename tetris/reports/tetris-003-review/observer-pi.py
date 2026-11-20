#!/usr/bin/env python3
import subprocess,os,sys,json,time,uuid,datetime
os.set_blocking(sys.stdout.fileno(), True)
call=str(uuid.uuid4()); role=os.path.basename(os.environ.get('PI_CODING_AGENT_DIR','unknown')); path=os.environ['TETRIS_USAGE_LOG']
def record(value):
 value.update(call=call,role=role,time=datetime.datetime.now(datetime.timezone.utc).isoformat())
 with open(path,'a') as f: f.write(json.dumps(value)+'\n')
record({'kind':'start'}); start=time.monotonic()
proc=subprocess.Popen([os.environ['TETRIS_REAL_PI'],*sys.argv[1:]],stdout=subprocess.PIPE)
for line in iter(proc.stdout.readline,b''):
 sys.stdout.buffer.write(line); sys.stdout.buffer.flush()
 try: event=json.loads(line)
 except (ValueError,UnicodeError): continue
 if event.get('type')=='message_end':
  msg=event.get('message',{})
  if msg.get('role')=='assistant':
   texts=[c.get('text','') for c in msg.get('content',[]) if c.get('type')=='text']
   result=None
   for text in texts:
    for row in text.splitlines():
     try: candidate=json.loads(row)
     except ValueError: continue
     if isinstance(candidate,dict): result=candidate
   record({'kind':'message','usage':msg.get('usage'),'model':msg.get('model'),'provider':msg.get('provider'),'stopReason':msg.get('stopReason'),'result':result,'error':msg.get('errorMessage')})
status=proc.wait();record({'kind':'end','status':status,'elapsedSeconds':round(time.monotonic()-start,3)});sys.exit(status)

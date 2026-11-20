import json,collections,datetime
from pathlib import Path
out=Path(__file__).parent
rows=[json.loads(l) for l in (out/'usage.jsonl').read_text().splitlines()]
roles={}
for role in ['planner','doer','validator']:
 messages=[r for r in rows if r['role']==role and r['kind']=='message']
 usage=[r['usage'] for r in messages if r.get('usage') is not None]
 roles[role]={'callsStarted':sum(r['kind']=='start' and r['role']==role for r in rows),'callsFinished':sum(r['kind']=='end' and r['role']==role for r in rows),'assistantMessages':len(messages),'messagesMissingUsage':len(messages)-len(usage),'messagesMissingCost':sum(u.get('cost',{}).get('total') is None for u in usage)}
 for key in ['input','output','cacheRead','cacheWrite','reasoning','totalTokens']:roles[role][key]=sum(u.get(key,0) for u in usage)
 roles[role]['reportedCostUSD']=sum(u.get('cost',{}).get('total',0) for u in usage)
 roles[role]['providerReportedCostMessages']=sum(u.get('cost',{}).get('totalFromProvider',False) for u in usage)
verdicts=[{'call':r['call'],'time':r['time'],**r['result']} for r in rows if r['role']=='validator' and isinstance(r.get('result'),dict) and 'satisfied' in r['result']]
totals={k:sum(r.get(k,0) for r in roles.values()) for k in ['callsStarted','callsFinished','assistantMessages','messagesMissingUsage','messagesMissingCost','input','output','cacheRead','cacheWrite','reasoning','totalTokens','reportedCostUSD','providerReportedCostMessages']}
summary={'roles':roles,'totals':totals,'verdicts':verdicts,'rejections':sum(not v['satisfied'] for v in verdicts),'findingsCount':sum(len(v.get('findings',[])) for v in verdicts),'failedCalls':[r for r in rows if r['kind']=='end' and r['status']!=0],'elapsedSeconds':(datetime.datetime.fromisoformat(rows[-1]['time'])-datetime.datetime.fromisoformat(rows[0]['time'])).total_seconds(),'notes':['Tokens and costs cover factory machine calls only, excluding report creation and orchestration.','input, output, cacheRead and cacheWrite are raw pi fields; totalTokens is retained directly. Reasoning tokens are not added again.','Costs are the emitted usage.cost.total values, not reconstructed from public rates and not a billing invoice.','Original run usage was not retained; no historical ratio can be calculated.']}
(out/'usage-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(totals,indent=2));print('Validator verdicts:',len(verdicts),'rejections:',summary['rejections'])

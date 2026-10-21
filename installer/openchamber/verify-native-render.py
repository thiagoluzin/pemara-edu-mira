import json, sys
from pathlib import Path
from PIL import Image, ImageChops
out=Path(sys.argv[1] if len(sys.argv)>1 else 'evidencias/native-exports-20261019')
baseline=Path('evidencias/export-v9-20261019')
differences=[]
for kind,count in [('student',9),('word',10)]:
 for number in range(1,count+1):
  suffix=f'{number:02}' if kind=='word' else str(number)
  actual=Image.open(out/f'{kind}-check-{suffix}.png').convert('RGB')
  expected=Image.open(baseline/f'final-{kind}-page-{suffix}.png').convert('RGB')
  if actual.size!=expected.size or ImageChops.difference(actual,expected).getbbox():differences.append(f'{kind}-{number}')
result={'passed':not differences,'pagesCompared':19,'differences':differences,'basis':'Pixel comparison with visually verified .9 export pages; renderer and frontend unchanged.'}
(out/'render-validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
assert not differences

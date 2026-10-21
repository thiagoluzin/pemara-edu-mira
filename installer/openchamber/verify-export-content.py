import json, re, sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader

root=Path(sys.argv[1] if len(sys.argv)>1 else 'evidencias/export-v9-20261019')
report=json.loads((root/'installed-exports.json').read_text(encoding='utf-8'))
spec=json.loads((root/'export-spec.json').read_text(encoding='utf-8'))
files={entry['format']:Path(entry['path']) for entry in report['exports']}
normalize=lambda value:re.sub(r'\s+',' ',value).strip()
pdf=PdfReader(files['pdf'])
student=normalize(' '.join(page.extract_text() or '' for page in pdf.pages))
with ZipFile(files['docx']) as package:
 xml=ET.fromstring(package.read('word/document.xml'))
 ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 teacher=normalize(' '.join(node.text or '' for node in xml.findall('.//w:t',ns)))
 paragraph_count=len(xml.findall('.//w:p',ns));tables=len(xml.findall('.//w:tbl',ns))
 assert paragraph_count>20
 assert not xml.findall('.//w:altChunk',ns), 'Word must contain native editable paragraphs, not embedded HTML'
for scene in spec['scenes']:
 assert normalize(scene['title']) in student, 'Missing PDF scene '+scene['title']
 assert normalize(scene['title']) in teacher, 'Missing Word scene '+scene['title']
 if scene.get('teacher_notes'):
  assert normalize(scene['teacher_notes']) not in student, 'Teacher note in student PDF'
  assert normalize(scene['teacher_notes']) in teacher, 'Missing editable teacher note'
 if scene['type']=='quiz':
  assert normalize(scene['question']) in student
  for answer in scene['answers']:assert normalize(answer) in student and normalize(answer) in teacher
  assert normalize(scene['explanation']) not in student
  assert normalize(scene['explanation']) in teacher
assert 'Gabarito Correto' not in student and 'Gabarito e Justificativa' not in student
assert 'Gabarito Correto' in teacher
for objective in spec['objectives']:assert normalize(objective) in teacher
assert all(len((page.extract_text() or '').strip())>25 for page in pdf.pages)
result={'passed':True,'studentPages':len(pdf.pages),'editableParagraphs':paragraph_count,'editableTables':tables,'allScenes':len(spec['scenes']),'teacherNotesAndAnswersOmittedFromStudentPdf':True,'teacherNotesAndAnswersEditableInWord':True}
(root/'export-content.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result))

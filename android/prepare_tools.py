#!/usr/bin/env python3
from pathlib import Path
import urllib.request, hashlib, zipfile, json
root=Path(__file__).resolve().parent/'tooling'
root.mkdir(exist_ok=True)
items={'platforms;android-35': {'url': 'https://dl.google.com/android/repository/platform-35_r02.zip', 'size': 64273788, 'sha1': '0bb560a90a7a2cbd0dd8348224d518b638fe7949'}, 'build-tools;35.0.0': {'url': 'https://dl.google.com/android/repository/build-tools_r35_linux.zip', 'size': 61958799, 'sha1': '2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc'}}
for name,d in items.items():
    p=root/(name.replace(';','-')+'.zip')
    with urllib.request.urlopen(d['url'],timeout=120) as response:p.write_bytes(response.read())
    assert p.stat().st_size==d['size']
    assert hashlib.sha1(p.read_bytes()).hexdigest()==d['sha1']
    with zipfile.ZipFile(p) as z:z.extractall(root)
u='https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.40.0/ecj-3.40.0.jar'
with urllib.request.urlopen(u,timeout=60) as response:data=response.read()
assert hashlib.sha256(data).hexdigest()=='05cc22a24e7982970f63a405fc6c820bc80b806f27f3c5a6236fc475f8f7152b'
(root/'ecj.jar').write_bytes(data)
print('SDK and Java compiler verified')

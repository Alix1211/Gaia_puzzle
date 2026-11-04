#!/usr/bin/env python3
"""Build the offline APK using Android SDK build-tools 35 and platform 35."""
from pathlib import Path
import subprocess, os, secrets, zipfile, hashlib, json, shutil

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT / 'project'
TOOLS = Path(os.environ.get('ANDROID_BUILD_TOOLS', ROOT/'tooling/android-15'))
ANDROID_JAR = Path(os.environ.get('ANDROID_JAR', ROOT/'tooling/android-35/android.jar'))
OUT = ROOT / 'out'
PRIVATE = ROOT / 'private'
OUT.mkdir(exist_ok=True)
PRIVATE.mkdir(exist_ok=True, mode=0o700)
game_source = ROOT.parent / 'index.html'
if game_source.is_file():
    (PROJECT/'assets').mkdir(exist_ok=True)
    shutil.copyfile(game_source, PROJECT/'assets/index.html')
for name in ['aapt2','d8','zipalign','apksigner']:
    (TOOLS/name).chmod(0o755)
def run(*cmd):
    subprocess.run([str(x) for x in cmd],check=True)
key=PRIVATE/'gaia-wellness-royale.p12'
password=PRIVATE/'signing-password.txt'
if not key.exists():
    if not os.environ.get('GAIA_FIRST_BUILD'):
        raise SystemExit('Signing key missing. Restore private signing backup, or use GAIA_FIRST_BUILD=1 only for a new app.')
    password.write_text(secrets.token_urlsafe(32))
    password.chmod(0o600)
    run('keytool','-genkeypair','-keystore',key,'-storetype','PKCS12','-alias','gaia-wellness-royale',
        '-storepass:file',password,'-keypass:file',password,'-keyalg','RSA','-keysize','3072',
        '-validity','10000','-dname','CN=GAIA Wellness Royale, OU=GAIA Project, O=GAIA, C=KR')
run(TOOLS/'aapt2','compile','--dir',PROJECT/'res','-o',OUT/'resources.zip')
run(TOOLS/'aapt2','link','-o',OUT/'base.apk','-I',ANDROID_JAR,'--manifest',PROJECT/'AndroidManifest.xml',
    '-A',PROJECT/'assets',OUT/'resources.zip')
classes=OUT/'classes'
classes.mkdir(exist_ok=True)
compiler=['javac'] if shutil.which('javac') else ['java','-jar',ROOT/'tooling/ecj.jar']
run(*compiler,'-encoding','UTF-8','-source','8','-target','8','-bootclasspath',ANDROID_JAR,
    '-d',classes,*sorted((PROJECT/'src').rglob('*.java')))
dex=OUT/'dex'
dex.mkdir(exist_ok=True)
run(TOOLS/'d8','--lib',ANDROID_JAR,'--min-api','23','--output',dex,*sorted(classes.rglob('*.class')))
with zipfile.ZipFile(OUT/'base.apk','a',compression=zipfile.ZIP_DEFLATED) as z:
    for f in dex.glob('*.dex'):z.write(f,f.name)
run(TOOLS/'zipalign','-P','16','-f','4',OUT/'base.apk',OUT/'aligned.apk')
apk=OUT/'GAIA-Wellness-Royale-v0.6.1.apk'
run(TOOLS/'apksigner','sign','--ks',key,'--ks-key-alias','gaia-wellness-royale',
    '--ks-pass','file:'+str(password),
    '--out',apk,OUT/'aligned.apk')
run(TOOLS/'apksigner','verify','--verbose','--print-certs',apk)
run(TOOLS/'zipalign','-c','-P','16','4',apk)
with zipfile.ZipFile(apk) as z:
    assert z.read('assets/index.html')==(PROJECT/'assets/index.html').read_bytes()
    assert z.read('classes.dex')[:4]==b'dex\n'
    assert 'AndroidManifest.xml' in z.namelist()
result={'apk':apk.name,'package':'com.gaia.wellnessroyale','version':'0.6.1-apk.1',
    'size':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),
    'html_sha256':hashlib.sha256((PROJECT/'assets/index.html').read_bytes()).hexdigest(),
    'verified':['APK signature','ZIP alignment','DEX present','embedded HTML byte identity'],
    'not_verified':['Android device installation and UI','physical vibration motor']}
(OUT/'build-result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

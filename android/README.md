# GAIA Wellness Royale Android APK

2026-11-04 최초 오프라인 APK. 원본 `index.html`을 그대로 내장하며 퍼즐 규칙·성장·밸런스는 변경하지 않았습니다. 터치 미니게임은 포함하지 않습니다.

- 앱 ID: `com.gaia.wellnessroyale`
- 버전: `0.6.1-apk.1` / versionCode `60101`
- Android 6.0(API 23) 이상, target API 35, CPU 공용 Java/WebView 앱
- 가로·세로 회전 시 WebView 재생성 방지, DOM 저장, 네이티브 진동 연결, 백그라운드 음소거, 전체화면
- 게임은 전부 내장되며 INTERNET 권한이 없습니다. 자동 온라인 업데이트는 미구현입니다. 게임 변경 시 동일 키로 새 APK를 빌드합니다.
- 기존 브라우저의 세이브는 이 앱으로 자동 이전되지 않습니다. 완료한 판의 레벨·XP·클리어 기록은 앱 내에 저장됩니다.

## 검증

APK v1/v2/v3 서명, ZIP 정렬, DEX 존재, 내장 HTML과 원본 바이트 일치를 확인했습니다. Android 기기 설치·화면·물리 진동은 미검증입니다. `build-result.json`에 크기와 SHA256을 기록했습니다.

## 재빌드

Java 런타임과 Python 3 필요. `python android/prepare_tools.py`로 고정된 SDK 도구와 Java 컴파일러를 받습니다. 개인 서명 백업의 `private/`를 `android/private/`로 복원한 다음 `python android/build_apk.py`를 실행합니다. 저장소 루트의 `index.html`이 자동 내장됩니다.

이 앱의 최초 서명 키는 개인 백업으로 따로 전달했습니다. 키가 없으면 빌드가 중단됩니다. 기존 앱 업데이트에는 새 키를 만들지 마세요. 새 앱의 최초 빌드만 `GAIA_FIRST_BUILD=1`을 사용합니다.

`project/assets/index.html`, `tooling/`, `out/`, `private/`는 Git에서 제외합니다. 서명 키·비밀번호를 공개 저장소에 올리지 않습니다.

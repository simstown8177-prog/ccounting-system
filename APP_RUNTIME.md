# App Runtime Plan

이 프로젝트는 무료 유지와 빠른 수정 반영을 우선으로, 웹 코드를 중심에 둔 앱 구조를 사용한다.

## 목표 플랫폼

- Windows
- Android

## 권장 구조

1. 웹앱 유지
- `server.js` 와 정적 프론트 파일이 핵심 런타임이다.
- 기능 수정은 계속 이 코드베이스에서 진행한다.
- Studio 같이 웹 터미널이 불안정한 환경에서는 `npm run start:bg` 로 서버를 백그라운드 런처로 실행한다.
- 런타임 상태 확인은 `npm run status`, 중지는 `npm run stop`, 점검은 `npm run test:runtime` 기준으로 통일한다.

2. PWA 제공
- `manifest.webmanifest`
- `sw.js`
- 공통 아이콘 자산
- Android/Windows 브라우저에서 설치 가능

3. Android 앱 패키징
- 이후 필요 시 `Capacitor` 로 감싼다.
- 핵심 화면/로직/API 는 그대로 재사용한다.
- 현재 저장소에는 `capacitor.config.json` 과 `android/` 프로젝트 골격이 추가되어 있다.
- 현재 `server.url` 은 운영 주소 `https://ccounting-system.onrender.com` 기준으로 설정되어 있다.
- 로컬 빌드 전제조건은 `JDK 21` 과 Android SDK 경로가 잡힌 `android/local.properties` 이다.

## 수정 방식

- 화면, 기능, API, DB 변경
  - 웹 코드 수정 후 서버 반영
  - Android 앱도 같은 서버를 보면 별도 앱 재배포 없이 반영 가능

- 앱 이름, 앱 아이콘, 권한, 네이티브 파일 처리 같은 앱 껍데기 변경
  - Android 패키지 재빌드 필요

## 무료 운영 원칙

- Windows: 웹 또는 설치형 PWA 사용
- Android: PWA 우선, 필요 시 APK 직접 설치
- 스토어 등록 없이 내부 사용 기준

## 다음 단계

1. 모바일 화면 최적화
2. `capacitor.config.json` 의 `server.url` 을 실제 운영 주소로 변경
3. `npm run cap:sync`
4. `cd android && ./gradlew --no-daemon assembleDebug`
5. 생성물 확인: `android/app/build/outputs/apk/debug/app-debug.apk`
6. 필요 시 `npm run cap:android` 로 Android Studio 열어 APK 또는 AAB 빌드
7. 파일 업로드/다운로드, OCR, 알림 기능의 Android 실기기 점검

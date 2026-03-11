# App Runtime Plan

이 프로젝트는 무료 유지와 빠른 수정 반영을 우선으로, 웹 코드를 중심에 둔 앱 구조를 사용한다.

## 목표 플랫폼

- Windows
- Android

## 권장 구조

1. 웹앱 유지
- `server.js` 와 정적 프론트 파일이 핵심 런타임이다.
- 기능 수정은 계속 이 코드베이스에서 진행한다.

2. PWA 제공
- `manifest.webmanifest`
- `sw.js`
- 공통 아이콘 자산
- Android/Windows 브라우저에서 설치 가능

3. Android 앱 패키징
- 이후 필요 시 `Capacitor` 로 감싼다.
- 핵심 화면/로직/API 는 그대로 재사용한다.
- 현재 저장소에는 `capacitor.config.json` 과 `android/` 프로젝트 골격이 추가되어 있다.

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
4. `npm run cap:android`
5. Android Studio 에서 APK 또는 AAB 빌드
6. 파일 업로드/다운로드, OCR, 알림 기능의 Android 실기기 점검

# KGM.dev — 포트폴리오 블로그

Unity3D 클라이언트 개발자 권강민의 포트폴리오 사이트입니다.  
Jekyll + GitHub Pages 기반으로 운영됩니다.

---

## 🚀 적용 방법

### 1단계 — 기존 파일 정리

GitHub에서 `lthel1047.github.io` 저장소를 열고,  
아래 파일들을 **삭제**하세요 (새 파일로 교체할 거예요):

- `_config.yml` (기존 내용 교체)
- `index.md` (삭제 후 `index.html`로 교체)

---

### 2단계 — 파일 업로드

이 폴더의 모든 파일을 저장소에 업로드합니다.  
GitHub 웹 UI에서 하는 방법:

1. 저장소 페이지에서 **Add file → Upload files** 클릭
2. 폴더 전체를 드래그 앤 드롭
3. **Commit changes** 클릭

또는 Git으로:
```bash
# 저장소 클론
git clone https://github.com/lthel1047/lthel1047.github.io.git
cd lthel1047.github.io

# 기존 파일 삭제 후 새 파일 복사
# (다운받은 폴더의 파일들을 여기에 붙여넣기)

git add --all
git commit -m "포트폴리오 리뉴얼 — 블랙/레드 테마"
git push origin master
```

---

### 3단계 — GitHub Pages 설정 확인

1. 저장소 → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **master** / `/ (root)`
4. **Save** 클릭

몇 분 후 `https://lthel1047.github.io` 에서 확인!

---

## ✏️ 내용 수정 방법

### 프로필/경력/프로젝트 수정
`index.html` 파일을 직접 편집하세요.  
HTML 구조에 맞춰 텍스트만 바꾸면 됩니다.

### 블로그 글 작성
`_posts/` 폴더에 마크다운 파일을 추가합니다.

**파일명 규칙:** `YYYY-MM-DD-제목.md`

```markdown
---
layout: post
title: "글 제목"
category: Unity Editor
description: 짧은 설명 (블로그 목록에 표시)
tags: [Unity, C#, 태그]
date: 2026-02-01
---

여기서부터 본문 작성...
```

---

## 🎨 색상 변경

`assets/css/style.css` 상단의 CSS 변수를 수정하세요:

```css
:root {
  --red: #d42b2b;      /* 메인 액센트 색상 */
  --red-dark: #a01e1e; /* 어두운 레드 */
  --red-light: #fff0f0;/* 연한 레드 배경 */
}
```

---

## 📁 파일 구조

```
lthel1047.github.io/
├── _config.yml          ← 사이트 기본 설정
├── _layouts/
│   ├── default.html     ← 공통 레이아웃 (nav + footer)
│   └── post.html        ← 블로그 포스트 레이아웃
├── _posts/              ← 블로그 글 (YYYY-MM-DD-제목.md)
├── assets/
│   ├── css/style.css    ← 전체 스타일 (여기서 디자인 수정)
│   └── js/main.js       ← 간단한 인터랙션
├── blog/
│   └── index.html       ← 블로그 목록 페이지
├── images/              ← 이미지 파일 보관
├── index.html           ← 메인 포트폴리오 페이지
└── Gemfile              ← Jekyll 의존성
```

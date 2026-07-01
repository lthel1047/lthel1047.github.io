---
layout: post
title: "Dave DLC 심화 — QuestManager & 초밥집 설계 구조"
date: 2026-06-29
categories: 프로젝트 후기
tags: [Unity, C#, UniTask, 콘텐츠설계, 퀘스트시스템, VR, DLC]
description: "퀘스트 흐름과 초밥 미니게임을 이벤트만으로 연결한 설계 — 기존 코드 비침습 원칙을 유지하면서 콘텐츠 확장성을 어떻게 확보했는지 정리한다."
---

[← 테크노트]({{ site.baseurl }}/blog/) 프로젝트 회고

# Dave DLC 심화 — QuestManager & 초밥집 설계 구조

2026년 06월 29일

`Unity` `C#` `UniTask` `콘텐츠설계` `퀘스트시스템` `VR`

---

이전 포스트([초밥집 & 헌팅 시스템 개발기]({{ site.baseurl }}/프로젝트%20회고/2026/03/31/dave-the-diver-dlc.html))에서는 게임플레이 구현 중심으로 정리했다.  
이번에는 **어떤 구조로 퀘스트와 미니게임을 연결했는지**, 즉 콘텐츠 설계 측면을 정리한다.

---

## 핵심 원칙 — 이벤트만으로 연결

Dave DLC에는 두 가지 독립 모듈이 있다.

- **QuestManager** — NPC 대화 → 퀘스트 수주 → 완료 → 보상 전 과정 관리
- **SushiHouse** — VR 초밥 쿠킹 미니게임 전체 (손님 AI, 서빙, 점수)

이 둘은 **C# event 하나만으로 연결**된다.  
QuestManager가 이벤트를 발행하면 SushiHouse가 구독해 미니게임을 시작하고,  
미니게임이 끝나면 QuestManager의 공개 메서드를 호출하는 것이 전부다.

```
QuestManager ─── OnCookingSessionReady ──▶ MenuRegistrationUI (SushiHouse)
QuestManager ◀── NotifyCookingSessionFinished() ── CookingGameManager
```

이 구조 덕분에 초밥집 미니게임은 퀘스트 시스템 없이도 독립 실행이 가능하다.  
나중에 퀘스트 조건이나 진입 트리거가 바뀌어도 미니게임 코드는 건드리지 않아도 된다.

---

## QuestManager — 퀘스트 라이프사이클 전체 관리

### 퀘스트 타입 (QuestType)

Dave DLC에는 NPC가 두 명 등장한다.  
- **반쵸 (Bancho)** — 어종 납품 및 요리 요청
- **더프 (Duff)** — 재료 수집 및 무기 제작 요청

이 두 NPC의 퀘스트 완료 방식이 다르기 때문에 `QuestType` enum으로 분기했다.

```csharp
public enum QuestType
{
    FishDelivery,           // 지정 어종 납품으로 클리어 (반쵸)
    FishDeliveryAndSushi,   // 재료 충족 → 요리 세션 자동 시작 (반쵸)
    WeaponCraft,            // 재료 수집 후 무기 제작 완료 (더프)
    WeaponCraftAndRetrieve, // 무기 제작 → Dave에게 전달 → 보상 수령 (더프)
}
```

`FishDeliveryAndSushi`가 핵심이다.  
퀘스트 완료 대사가 끝나는 순간 `OnCookingSessionReady` 이벤트가 발행되고,  
SushiHouse 측 `MenuRegistrationUI`가 이를 구독해 메뉴 선택 패널을 자동으로 열어준다.

### 퀘스트 흐름

```
플레이어가 NPC 클릭
    │
    ▼
QuestManager.OpenQuestForNpc(npcId)
    │
    ├─[수주 가능] ──▶ 수주 대사 ──▶ QuestPanel(수락/거절)
    │                              수락 시 activeQuestId 저장
    │
    └─[진행 중] ──▶ QuestPanel(진행 현황 표시)
                        │
                        └─[완료 조건 충족] ──▶ 완료 대사
                                              ├─ OnCookingSessionReady 발행 (반쵸)
                                              ├─ OnWeaponCraftingSessionReady 발행 (더프)
                                              └─ completedQuestIds에 ID 추가
```

### 세이브 데이터 구조

해금 여부를 별도 필드로 저장하지 않았다.  
`completedQuestIds`에 퀘스트 ID가 있으면 해금된 것으로 런타임에 판별하는 방식이다.  
새로운 저장 필드나 마이그레이션이 불필요하다.

```csharp
public class NpcQuestProgress
{
    public DaveNpcId npcId;
    public List<int> completedQuestIds   = new List<int>();
    public int       activeQuestId       = -1;
    public int       pendingCookQuestId  = -1;
    public int       pendingCraftQuestId = -1;
    public bool      hasCompletedSushiTutorial;
}
```

---

## SushiHouse — 이벤트 구독부터 세션 종료까지

### 세션 진입 (MenuRegistrationUI)

```csharp
private void OnEnable()
{
    QuestManager.OnCookingSessionReady += HandleCookingSessionReady;
}

private void OnDisable()
{
    QuestManager.OnCookingSessionReady -= HandleCookingSessionReady;
}

private void HandleCookingSessionReady()
{
    gameObject.SetActive(true); // 메뉴 선택 패널 오픈
}
```

`OnEnable` / `OnDisable`에서 구독·해제하는 표준 패턴을 유지해  
패널이 비활성 상태일 때 이벤트가 쌓이지 않도록 했다.

### 메뉴 잠금 처리 (MenuRegistrationSlot)

레시피마다 `unlockKey`를 두고, `DaveLevelManager`가 해당 키를 해금했을 때만 선택 가능하도록 했다.  
잠긴 메뉴는 수량을 0으로 강제해 실수로 주문 목록에 들어가는 것을 방지한다.

```csharp
private void RefreshLockState()
{
    string key = Recipe.result?.unlockKey ?? string.Empty;

    m_isLocked = !string.IsNullOrEmpty(key)
                 && DaveLevelManager.Instance != null
                 && !DaveLevelManager.Instance.IsContentUnlocked(key);

    if (m_lockOverlay     != null) m_lockOverlay.SetActive(m_isLocked);
    if (m_incrementButton != null) m_incrementButton.Interactable = !m_isLocked && Count < m_maxCount;
    if (m_slotButton      != null) m_slotButton.Interactable      = !m_isLocked;
    if (m_isLocked) Count = 0;
}
```

### 세션 종료 통지 (CookingGameManager)

요리 세션이 끝나면 QuestManager의 공개 메서드를 한 번 호출하는 것이 전부다.

```csharp
private async UniTask EnterResultsAsync()
{
    State = E_COOKING_GAME_STATE.Results;
    // ... 결과 화면 처리 ...

    QuestManager.Instance?.NotifyCookingSessionFinished();
}
```

`QuestManager`는 이 호출을 받아 반쵸의 다음 퀘스트를 자동으로 열어준다.

---

## 데이터 파이프라인 — CSV → ScriptableObject → 런타임

퀘스트 데이터는 기획팀이 CSV로 관리하고, Unity 에디터에서 ScriptableObject로 변환한다.

```
[CSV 파일]
DTD_DLC_Quest_Info.csv
DTD_DLC_Quest_Requirements.csv
        │
        ▼  QuestBookEditor "Rebuild from CSV" 버튼
[ScriptableObject]
DuffQuestBook / BanchoQuestBook
        │
        ▼  런타임
QuestManager ──Inspector─▶ QuestBookRegistry
```

이 구조 덕분에 **퀘스트 추가는 CSV 행 추가 + 버튼 클릭**으로 끝난다.  
코드 변경 없이 기획자가 퀘스트를 추가·수정할 수 있는 환경을 만든 것이 이 설계의 목표였다.

---

## 정리 — 콘텐츠 개발자 시점에서 본 설계 선택

| 선택 | 이유 |
|---|---|
| 이벤트만으로 QuestManager ↔ SushiHouse 연결 | 미니게임 독립성 확보, 퀘스트 조건 변경 시 미니게임 코드 무변경 |
| `completedQuestIds`로 해금 판별 | 별도 해금 플래그 불필요, 마이그레이션 부담 제거 |
| CSV → SO 파이프라인 | 퀘스트 추가를 코드 없이 기획 레벨에서 처리 |
| `QuestEntryBase` 추상 베이스 패턴 | NPC가 늘어나도 공통 구조를 재사용, 새 NPC = 새 QuestEntry 클래스 추가만 |

라이브 서비스 환경에서 콘텐츠를 개발한다는 것은  
**기존 코드를 건드리지 않으면서** 새 콘텐츠를 붙이는 일이다.  
이 DLC에서 가장 신경 쓴 것도 바로 그 지점이었다.

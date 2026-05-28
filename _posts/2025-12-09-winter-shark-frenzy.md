---
layout: post
title: "Winter Shark Frenzy — 메갈로돈 시스템 개발기"
category: 프로젝트 회고
description: 라이브 서비스 코드에 새 기능을 덧붙이는 것의 한계를 배운 경험
tags: [Unity, Photon PUN, 멀티플레이, 트러블슈팅, 라이브 서비스]
date: 2025-12-09
---

Real VR Fishing의 겨울 시즌 이벤트로, 기존 낚시 구조 위에 **메갈로돈 전용 시스템**을 추가하는 작업이었다. 수정한 파일은 `BaitController.cs`, `FishingController.cs`, `ScoreController.cs` 세 가지.

> **참고 (2025.12.09):** 이 작업은 초기에 멀티 협동 낚시로 기획됐으나, 개발 과정에서 단일 낚시로 변경됐다.

---

## 메갈로돈 합류 로직

기존 상어가 낚시에 합류하는 Ratio 계산 구조를 그대로 활용했다. 상어 교체 시점에 `megaSharkRatio` 조건을 추가로 계산해, 조건 충족 시 메갈로돈으로 전환한다.

```csharp
// BaitController.cs 940행 부근
if (randomValue < currentStage.megaSharkRatio)
{
    if (Main.fishingController.isMegaSharkReady)
    {
        Main.fishingController.ChangeMegaSharkStart();
    }
}
```

멀티 환경에서는 `MultiplayManager.SetMegaSharkProperties()`로 메갈로돈 상태, 어종 ID, 랜덤 시드값을 룸 전체에 동기화했다.

```csharp
public void ChangeMegaSharkStart()
{
    isNowMegaShark = true;
    FishItem sharkFishItem = PickMegaSharkFishItem();
    if (sharkFishItem == null)
        sharkFishItem = Main.envController.GetStageItem().MegaSharkSpecies[0].FishItem;

    int seed = (int)System.DateTime.Now.Ticks;

    if (PhotonNetwork.IsConnected && PhotonNetwork.InRoom)
    {
        MultiplayManager.SetMegaSharkProperties(true, sharkFishItem.ID, seed);
    }

    StartCoroutine(WaitToChangeToMegaShark(sharkFishItem, seed, sharkFishItem.ID));
}
```

**합류 흐름 요약**

```
상어 Ratio 계산 성공
→ megaSharkRatio 추가 계산
→ ChangeMegaSharkStart() 호출
→ 5초 대기 후 메갈로돈으로 전환
→ 멀티 연결 시 CustomProperty로 상태 · 어종 ID · 시드값 동기화
```

---

## 메갈로돈 전용 결과창

메갈로돈은 일반 물고기와 달리 **"놓아주기 / 가지기" 없이 "확인" 버튼만 존재**하는 전용 결과창이 필요했다.

불필요한 UI 오브젝트는 `offList`로 관리해 일괄 비활성화 처리했다.

```csharp
private void InfoTextEnable(bool enable)
{
    foreach (var go in offList)
    {
        go.gameObject.SetActive(enable);
    }

    if (enable == false)
    {
        buttonKeep.transform.localPosition = new Vector3(0, -150, -8);
        infoGold.rectTransform.anchoredPosition = new Vector2(65, 0);
    }
    else
    {
        buttonKeep.transform.localPosition = new Vector3(220, -96, -8);
        infoGold.rectTransform.anchoredPosition = new Vector2(-150, -53);
        keepText.text = LocalizationManager.GetTranslation("FishingSpot/0002");
    }
}
```

"확인" 버튼 클릭 시 2초간 데이터 저장 처리 후 낚시 상태를 초기화하는 흐름은 기존 `ShowScore()` 구조를 기반으로 `ShowMegaSharkScore()`를 별도 구현해 재사용성을 높였다.

---

## 미해결 이슈

> 후속 작업자를 위한 인수인계 참고 사항

| 이슈 | 내용 | 상태 |
|---|---|---|
| **RemoteFish 스케일 미동기화** | Fighting 중 점프 시 게스트 화면에서 물고기가 작게 보이는 현상. Catching 시에는 정상 복구. 사이드 임팩트 우려로 작업 보류. | 미수정 (서비스 영향 낮음) |
| **메갈로돈 회전 버그** | 약 8~9 거리 지점에서 메갈로돈이 심하게 회전하는 현상. 버그처럼 보일 수준. 원인 미파악. | 수정 실패 |

---

## 협동 → 단일 낚시 전환 경위

초기 기획은 멀티에서 메갈로돈을 **협동으로 낚는 시스템**이었다. 기본 위치·이동 방향 동기화는 기존 스트림 구조로 처리할 수 있었지만, **패턴 노드 이벤트(좌우 이동, 점프 등)의 실시간 동기화**에서 문제가 발생했다.

서버 딜레이로 인해 클라이언트 간 연출이 엇갈리는 현상이 반복됐고, 랜덤 시드 도입을 시도했으나 중간 입장한 게스트의 시드 진행 상태를 복원하는 데 한계가 있었다. 결국 개발 마감 기한 내 해결이 어렵다고 판단해 단일 낚시로 복귀했다.

---

## 회고

이 작업에서 가장 크게 배운 건 **라이브 서비스 코드에 새로운 기능을 덧붙이는 방식의 한계**였다.

기존 코드를 유지한 채 개발하는 게 편해 보였는데, 개발이 진행될수록 기존 코드가 협동 구조를 전혀 고려하지 않았다는 점이 계속 발목을 잡았다.

> 처음부터 새롭게 설계하고 기존에 필요한 코드만 가져오는 방식이 버그를 최소화하는 데 훨씬 효과적이었을 것이다.

라이브 서비스에 기능을 추가할 때는 기존 코드 재사용의 편의성과 새로운 구조 설계의 안정성 사이에서 더 신중하게 판단해야 한다는 것을 이 프로젝트가 가르쳐줬다.

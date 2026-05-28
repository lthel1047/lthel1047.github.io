---
layout: post
title: "CustomProperty vs RPC — 언제 뭘 써야 할까"
category: Photon PUN
description: 할로윈 이벤트 개발에서 직접 겪은 동기화 설계 원칙 정리
tags: [Photon PUN, 멀티플레이, 네트워크 동기화]
date: 2025-10-20
---

Real VR Fishing의 할로윈 이벤트 DLC를 개발하면서, Photon의 `CustomProperty`와 `RPC` 중 어느 걸 써야 할지 헷갈리는 경우가 많았습니다. 직접 겪으며 정리한 원칙을 공유합니다.

## 결론부터

> **CustomProperty는 상태(state) 관리**, **RPC는 이벤트(event) 처리**

이 한 문장으로 대부분의 상황을 정리할 수 있습니다.

## CustomProperty를 써야 할 때

CustomProperty는 룸/플레이어의 **지속적인 상태값**을 저장하는 데 쓰입니다.

- 점수, 타이머, 룸 페이즈 등 **언제든 조회 가능해야 하는 데이터**
- 나중에 방에 입장한 플레이어도 **현재 상태를 바로 받아야 할 때**
- 마스터 클라이언트가 **중앙에서 관리하는 데이터**

```csharp
// 예시: 타이머와 점수를 CustomProperty로 관리
Hashtable props = new Hashtable {
    { "timer", remainingTime },
    { "score", currentScore },
    { "phase", roomPhase }
};
PhotonNetwork.CurrentRoom.SetCustomProperties(props);
```

할로윈 이벤트에서 타이머가 끝난 뒤 게스트가 입장했을 때 몬스터가 재등장하는 버그가 있었습니다. 원인은 타이머 상태를 CustomProperty가 아닌 RPC로 처리했기 때문이었습니다. 뒤늦게 입장한 게스트는 이미 지나간 RPC를 받을 수 없었던 것입니다.

## RPC를 써야 할 때

RPC는 **일회성 이벤트**에 적합합니다.

- 폭발, 사운드 재생, 이펙트 발생 등 **한 번만 트리거되면 되는 것**
- 데이터를 저장할 필요 없이 **즉각적인 반응이 필요한 것**

```csharp
// 예시: 몬스터 처치 이펙트는 RPC가 적합
[PunRPC]
void PlayMonsterDeathEffect(int monsterId) {
    // 이미 처리된 몬스터의 이펙트 재생
    SpawnEffect(monsterId);
}
```

단, RPC는 **1회성**이기 때문에 뒤늦게 입장한 플레이어에게 전달되지 않습니다. 이 점을 반드시 고려해야 합니다.

## 요약

| 구분 | CustomProperty | RPC |
|---|---|---|
| 특성 | 지속 상태값 | 일회성 이벤트 |
| 신규 입장자 | 현재 값 자동 수신 | 수신 불가 |
| 주용도 | 점수, 타이머, 페이즈 | 이펙트, 사운드, 알림 |
| 남용 시 문제 | 불필요한 동기화 오버헤드 | 중간 입장 버그 |

이 두 가지를 명확히 구분해서 쓰는 것만으로도 멀티 동기화 버그의 상당수를 예방할 수 있습니다.

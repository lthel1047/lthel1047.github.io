---
layout: post
title: "Real VR Fishing × Dave the Diver DLC — 초밥집 & 헌팅 시스템 개발기"
category: 프로젝트 후기
description: 콜라보 DLC 두 가지 신규 콘텐츠를 기존 코드 건드리지 않고 설계한 과정
tags: [Unity, UniTask, FSM, Photon, VR, DLC, 트러블슈팅]
date: 2026-03-31
---

글로벌 히트작 **Dave the Diver**와의 콜라보 DLC로, Real VR Fishing 위에 두 가지 신규 콘텐츠를 설계·구현했다.

1. **초밥집 쿠킹 미니게임** — 손님을 맞아 초밥을 만들고 서빙하는 VR 레스토랑 시뮬레이터
2. **Dave 헌팅 시스템** — 낚시 스테이지에서 Dave가 물고기를 던져주는 협력형 이벤트

두 콘텐츠 모두 기존 낚시 게임 아키텍처에 **비침습적으로 올라타도록** 설계했다. 기존 `Scripts/` 코드를 건드리지 않고 `Dave_CollaboDLC/Scripts/` 하위에 독립 모듈로 구성한 것이 핵심이었다.

> **스택:** C#, UniTask, Addressables, OVR SDK, Unity 6, Meta Quest

---

## 1. 초밥집 쿠킹 미니게임

### 전체 게임 흐름 — 5단계 상태 머신

미니게임 전체를 `CookingGameManager` 하나로 관리했다.

```
Idle → Tutorial → Countdown → Playing → Results
```

| 상태 | 주요 동작 |
|---|---|
| `Idle` | 플레이어 이동 가능, 인터랙터블 잠금, 로비 BGM |
| `Tutorial` | 이동 잠금, 튜토리얼 완료 콜백 대기 |
| `Countdown` | 3초 카운트다운 코루틴 |
| `Playing` | 손님 스폰 시작, 쿠킹 BGM, 점수·생명력 초기화 |
| `Results` | 손님 전원 퇴장 대기(UniTask) → 씬 정리 → 결과 계산 |

**핵심 설계 포인트:** Results 진입 시 즉시 UI를 표시하지 않고, 모든 손님이 빠져나간 다음에 정리·결과 발행 순서를 보장했다.

```csharp
private async UniTaskVoid CleanupThenPublish()
{
    m_customerManager.ForceAllLeave();
    await UniTask.WaitUntil(() => m_customerManager.ActiveCustomers <= 0);

    if (State != E_COOKING_GAME_STATE.Results) return;

    m_storeDoar.SetBool("Open", false);
    await UniTask.Delay(TimeSpan.FromSeconds(1f));

    CleanupScene();
    OnStateChanged?.Invoke(E_COOKING_GAME_STATE.Results); // 이제 UI 시작
    PublishResults();
}
```

---

### 손님 AI — 8-state FSM

손님 한 명의 생애 주기를 FSM으로 설계했다.

```
Entering → Sitting → Ordering → Waiting → Served → (반복) → Leaving → Gone
```

**다중 주문 시스템**은 `Queue<RecipeData>`로 남은 주문을 관리한다. 식사가 끝나면 큐에서 다음 주문을 꺼내거나, 큐가 비면 퇴장 흐름으로 진입한다.

```csharp
private IEnumerator EatThenDecide()
{
    yield return new WaitForSeconds(m_eatDuration);

    if (m_gracefulLeaving || m_remainingOrders.Count == 0)
        EnterState(E_CUSTOMER_STATE.Leaving);
    else
    {
        RecipeData next = m_remainingOrders.Dequeue();
        AssignNextOrder(next.result.id, next.result);
    }
}
```

**인내심 시스템**은 초당 타이머 UI를 업데이트하고, 잔여 시간이 `angerThreshold` 이하로 떨어지면 분노 애니메이션을 1회만 트리거한다.

```csharp
if (!angerTriggered && RemainingTime <= m_angerThreshold)
{
    angerTriggered = true;
    SetAnimTrigger(s_hashDelay);
}
```

---

### 트러블슈팅 — 하트 이펙트가 첫 주문에만 표시되는 버그

서빙 성공 시 하트 파티클이 **첫 번째 주문에는 표시되지만, 같은 손님의 두 번째 주문부터는 나타나지 않는** 버그가 발생했다.

**원인 분석 과정**

1. `StopAllCoroutines()` 가설 → `GracefulLeave()` 흐름 확인 후 기각
2. `Invoke()` vs Coroutine 차이 발견 — `Invoke()`는 `StopAllCoroutines()`에 영향받지 않음
3. 두 번째 호출 시 ParticleSystem이 비활성 상태에서 `Stop Action = Disable`이 즉시 발동하는 문제 발견
4. 프리팹 분석 결과 `EmissionModule: enabled: 0`, `startSpeed: 0` 발견 → Inspector에서 수정

**해결:** `SetActive(false) → SetActive(true)` 토글로 `Play On Awake`를 `t=0`에서 재트리거.

```csharp
private void ShowSuccessEffect()
{
    if (m_sucessPanel == null) return;

    var systems = m_sucessPanel.GetComponentsInChildren<ParticleSystem>(true);

    foreach (var ps in systems)
        ps.gameObject.SetActive(false);

    m_sucessPanel.SetActive(true);

    foreach (var ps in systems)
        ps.gameObject.SetActive(true);
}
```

> **배운 점:** `Stop Action = Disable`은 명시적 `Stop()` 호출에도 발동한다는 엔진 내부 동작을 직접 디버깅으로 파악했다.

---

## 2. Dave 헌팅 시스템

### 행동 조율 — DaveBehaviorCoordinator

게임 상태가 `READY`일 때만 Dave가 행동하고, `m_requestRate` 가중치로 **헌팅**과 **아이템 요청** 중 하나를 랜덤 선택한다. 행동 완료 후 랜덤 쿨다운(90~180초)으로 빈도를 조절한다.

```csharp
private IEnumerator CoordinateRoutine()
{
    yield return new WaitForSeconds(Random.Range(m_startDelayMin, m_startDelayMax));
    while (true)
    {
        yield return new WaitUntil(() =>
            Main.Instance.fishingController.gameState == FISHINGSTATE.READY);
        ActivateRandom();
        yield return new WaitWhile(() => m_hunting.InProcess || m_request.InProcess);
        yield return YieldCache.WaitForSeconds(Random.Range(m_cooldownMin, m_cooldownMax));
    }
}
```

---

### 물고기 투척 — 2차 베지어 곡선 포물선

물고기가 자연스러운 포물선을 그리며 날아오도록 2차 베지어 곡선을 직접 계산했다.

```csharp
Vector3 ctrl = (from + landingPos) * 0.5f + Vector3.up * m_throwArcHeight;

while (elapsed < m_throwDuration)
{
    float t = Mathf.Clamp01(elapsed / m_throwDuration);
    float u = 1f - t;
    // B(t) = u²·P0 + 2·u·t·P1 + t²·P2
    fishPos = u * u * from + 2f * u * t * ctrl + t * t * target;
    m_currentFishObj.transform.position = fishPos;
    await UniTask.Yield();
}
```

**애니메이션 상태 대기 패턴**은 Animator 상태 태그를 폴링해 특정 타이밍에 로직이 실행되도록 구현했다.

```csharp
private async UniTask WaitForAnimTag(string animTag, float exitAt = 1f)
{
    await UniTask.Yield();
    while (!m_animator.GetCurrentAnimatorStateInfo(0).IsTag(animTag))
        await UniTask.Yield();
    while (m_animator.GetCurrentAnimatorStateInfo(0).normalizedTime < exitAt)
        await UniTask.Yield();
}
```

---

## 기술 스택 요약

| 항목 | 사용 기술 |
|---|---|
| 비동기 처리 | UniTask (`async UniTaskVoid`, `WaitUntil`, `Delay`) |
| 에셋 로딩 | Addressables (`InstantiateAsync`, `ReleaseInstance`) |
| 애니메이션 | Animator Hash 캐싱, 상태 태그 폴링 |
| VR 입력 | OVR SDK, XRInputUtility |
| 파티클 | `GetComponentsInChildren<ParticleSystem>(true)`, Stop Action 분석 |
| 아키텍처 | 상태 머신, C# Action 이벤트, 오브젝트 풀 |

---

## 후기

이 프로젝트에서 가장 크게 배운 건 **비침습적 설계**의 가치였다. 기존 낚시 게임 코드를 건드리지 않고 DLC 콘텐츠를 올려붙이는 구조를 잡으면서, 처음부터 확장을 고려한 설계가 실제로 얼마나 큰 차이를 만드는지 실감했다.

---
layout: post
title: "CustomPropertyDrawer로 인스펙터 가독성 개선하기"
category: Unity Editor
description: FloatFlowDataDrawer 제작 과정 기록
tags: [Unity Editor, CustomPropertyDrawer, 툴 개발]
date: 2026-01-10
---

튜토리얼 개선 작업 중, 기획자가 데이터를 잘못 설정하는 오류가 반복됐습니다. 인스펙터에 변수가 너무 많이 나열되어 있었기 때문입니다. `CustomPropertyDrawer`를 만들어 해결한 과정을 공유합니다.

## 문제

```
Element 0: float value1 = 0
Element 0: float value2 = 0  
Element 0: float value3 = 0
Element 0: int type = 0
Element 0: string id = ""
```

인덱스를 접어두면 어떤 타입인지, 어떤 시퀀스인지 전혀 알 수 없는 상태였습니다. 기획자가 매번 저를 불러 데이터를 설정해달라고 했고, 이게 반복되면 개발 시간을 크게 잡아먹습니다.

## 해결책

`CustomPropertyDrawer`를 만들어서 접힌 상태에서도 핵심 정보가 보이도록 했습니다.

```csharp
[CustomPropertyDrawer(typeof(FlowData))]
public class FloatFlowDataDrawer : PropertyDrawer {
    public override void OnGUI(Rect position, SerializedProperty property, GUIContent label) {
        EditorGUI.BeginProperty(position, label, property);

        // 타입 정보를 헤더에 표시
        var typeProp = property.FindPropertyRelative("type");
        var idProp = property.FindPropertyRelative("id");
        
        string header = $"[{typeProp.enumDisplayNames[typeProp.enumValueIndex]}] {idProp.stringValue}";
        label.text = header;

        // 타입에 따라 관련 필드만 표시
        if (property.isExpanded) {
            // 타입별 필요한 필드만 그리기
            DrawRelevantFields(position, property, typeProp.enumValueIndex);
        }

        EditorGUI.EndProperty();
    }
}
```

## 결과

접힌 상태에서도:
```
Element 0: [Phase] Tutorial_Step1
Element 1: [Dialogue] intro_01
Element 2: [Action] fishing_start
```

이렇게 한눈에 파악할 수 있게 됐습니다. 기획자의 수정 요청이 눈에 띄게 줄었고, 저도 메인 개발에 집중할 수 있는 시간이 늘었습니다.

## 팁

`CustomPropertyDrawer`를 만들 때 가장 중요한 건 **기획자(사용자) 입장에서 생각하기**입니다. 개발자에게는 당연한 구조도 기획자에게는 낯설 수 있으니, 최대한 직관적으로 만드는 것이 핵심입니다.

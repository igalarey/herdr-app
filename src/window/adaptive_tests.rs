#[test]
fn automatic_panes_follow_membership_and_available_space() {
    in_own_process("adaptive_panes");
}

#[gpui::test]
fn adaptive_panes(cx: &mut gpui::TestAppContext) {
    use serde_json::json;
    if !running_alone("adaptive_panes") { return; }
    let layout = |auto: bool, sidebar: f32| json!({"id":"outer", "type":"row", "children":[
        {"id":"sidebar", "type":"block", "size":{"px":sidebar}, "content":{"mod":"probe"}},
        {"id":"context", "type":"block", "content":{"tab":"active", "arrangement":if auto {"auto"} else {"manual"},
            "pane":{"gap":6, "header":{"height":24,"content":{"mod":"probe"}}}}}
    ]});
    let (view, cx) = open_window(cx, "probe", r#"import { View, div } from "gpui-kit"; export default class Probe extends View { render() { return div(); } }"#, layout(true, 0.0));
    view.update_in(cx, |this, window, cx| {
        this.model = crate::model::Model::default();
        let mut tab = super::Tab::new("tab", "", "a", "term-a");
        tab.root = super::Node::container("tab", super::Axis::Row, vec![
            crate::model::pane("a", "term-a"), crate::model::pane("b", "term-b"),
            crate::model::pane("c", "term-c"),
            super::Node::block("d", super::Content::Mod { name:"probe".into(), props:json!({}) }),
        ]);
        tab.focus("b");
        this.model.add_space("space", "", "/", tab);
        this.model.add_tab("space", super::Tab::new("other", "", "other-pane", "other-term"));
        this.model.select_tab("tab");
        this.sync(window, cx);
    });
    let draw = |cx: &mut gpui::VisualTestContext| {
        for _ in 0..3 { cx.update(|w, cx| w.draw(cx).clear(cx)); }
    };
    cx.simulate_resize(gpui::size(px(1200.), px(800.)));
    draw(cx);
    let mut snapshot = view.update(cx, |this, _| (
        this.model.active_tab().unwrap().root.clone(),
        this.model.tab("other").unwrap().root.clone(),
        this.terms["a"].view.entity_id(),
        this.copies["d"].root.as_ref().unwrap().entity_id(),
    ));
    let bounds = |cx: &mut gpui::VisualTestContext| view.update(cx, |this, _| {
        let b = this.bounds.borrow(); [b["a"], b["b"], b["c"], b["d"]]
    });
    let membership = |count: usize, cx: &mut gpui::VisualTestContext| {
        view.update_in(cx, |this, w, cx| {
            for (index, pane) in this.model.spaces[0].tabs[0].root.children_mut().unwrap().iter_mut().enumerate() {
                pane.hidden = index >= count;
            }
            this.sync(w, cx);
        });
    };
    let shape = |width: f32, height: f32, count: usize, rows: usize, cx: &mut gpui::VisualTestContext| {
        cx.simulate_resize(gpui::size(px(width), px(height)));
        draw(cx);
        let mut ys: Vec<_> = view.update(cx, |this, _| {
            let b = this.bounds.borrow();
            this.model.active_tab().unwrap().root.visible_blocks().into_iter()
                .filter(|n| n.is_pane()).map(|n| b[&n.id].origin.y).collect()
        });
        assert_eq!(ys.len(), count);
        ys.sort_by(|a, b| a.partial_cmp(b).unwrap());
        ys.dedup();
        assert_eq!(ys.len(), rows, "{count} panes in {width}x{height}: columns first");
    };
    membership(2, cx);
    shape(1200., 1600., 2, 1, cx);
    shape(900., 1800., 2, 1, cx);
    shape(725., 1800., 2, 2, cx);
    for width in [726., 727., 725., 726.] { shape(width, 1800., 2, 2, cx); }
    shape(774., 1800., 2, 1, cx);
    for width in [773., 727., 726.] { shape(width, 1800., 2, 1, cx); }
    shape(725., 1800., 2, 2, cx);
    membership(1, cx);
    shape(740., 1800., 1, 1, cx);
    membership(2, cx);
    shape(740., 1800., 2, 1, cx);
    shape(1100., 1800., 2, 1, cx);
    membership(3, cx);
    shape(1100., 1800., 3, 1, cx);
    membership(4, cx);
    shape(1100., 1800., 4, 2, cx);
    membership(3, cx);
    shape(1100., 1800., 3, 1, cx);
    membership(4, cx);
    shape(1600., 1800., 4, 1, cx);
    view.update_in(cx, |this, w, cx| {
        this.model.spaces[0].tabs[0].root.children_mut().unwrap().push(crate::model::pane("extra", "term-extra"));
        this.sync(w, cx);
    });
    shape(1600., 1800., 5, 2, cx);
    view.update_in(cx, |this, w, cx| {
        this.model.spaces[0].tabs[0].root.remove("extra");
        snapshot.0 = this.model.spaces[0].tabs[0].root.clone();
        this.sync(w, cx);
    });
    shape(1600., 1800., 4, 1, cx);
    shape(1457., 1800., 4, 2, cx);
    for width in [1458., 1459., 1457.] { shape(width, 1800., 4, 2, cx); }
    shape(1554., 1800., 4, 1, cx);
    shape(1200., 800., 4, 2, cx);
    let b = bounds(cx);
    assert_eq!(b[0].origin.y, b[1].origin.y);
    assert!(b[2].origin.y > b[0].origin.y, "four panes must use two rows, not one narrow row");
    assert_eq!(b[0].origin.x, b[2].origin.x);
    // Only the context shrinks: the outer window has not changed.
    view.update(cx, |this, _| this.chrome = serde_json::from_value(layout(true, 800.)).unwrap());
    draw(cx);
    let b = bounds(cx);
    assert!(b[1].origin.y > b[0].origin.y, "the actual context rectangle must drive reflow");
    for width in [1199., 1201., 1200.] {
        cx.simulate_resize(gpui::size(px(width), px(800.)));
        draw(cx);
        assert!(bounds(cx)[1].origin.y > bounds(cx)[0].origin.y);
    }
    view.update_in(cx, |this, w, cx| {
        assert_eq!(this.model.active_tab().unwrap().root, snapshot.0);
        assert_eq!(this.model.tab("other").unwrap().root, snapshot.1);
        assert_eq!(this.terms["a"].view.entity_id(), snapshot.2);
        assert_eq!(this.copies["d"].root.as_ref().unwrap().entity_id(), snapshot.3);
        assert_eq!(this.model.active_tab().unwrap().focused.as_deref(), Some("b"));
        this.model.spaces[0].tabs[0].zoomed = Some("a".into());
        this.sync(w, cx);
    });
    draw(cx);
    assert!(bounds(cx)[0].size.height > px(700.));
    view.update_in(cx, |this, w, cx| {
        this.model.spaces[0].tabs[0].zoomed = None;
        this.chrome = serde_json::from_value(layout(false, 0.)).unwrap();
        this.sync(w, cx);
    });
    draw(cx);
    let b = bounds(cx);
    assert_eq!(b[0].origin.y, b[3].origin.y, "opt-out restores the original row");
    view.update_in(cx, |this, w, cx| {
        this.chrome = serde_json::from_value(layout(true, 0.)).unwrap();
        this.model.spaces[0].tabs[0].root.remove("c");
        this.sync(w, cx);
    });
    draw(cx);
    view.update(cx, |this, _| {
        let b = this.bounds.borrow();
        assert!(b["a"].size.width > px(350.));
        assert_eq!(this.model.active_tab().unwrap().root.panes().len(), 3);
        assert_eq!(this.terms["a"].view.entity_id(), snapshot.2);
        assert_eq!(this.copies["d"].root.as_ref().unwrap().entity_id(), snapshot.3);
    });
    let original = serde_json::to_value(&snapshot.0).unwrap();
    let nested = json!({"id":"tab","type":"row","children":[
        {"id":"nested","type":"column","children":[original["children"][0],original["children"][1]]},
        original["children"][2],original["children"][3]
    ]});
    for (label, field, value) in [
        ("nested paint", "background", json!("surface")),
        ("nested padding", "padding", json!(12)),
        ("nested border", "border", json!({"width":3,"color":"border"})),
        ("nested float", "floating", json!([{"id":"nested-float","content":{"mod":"probe"}}])),
        ("nested gap", "gap", json!(13)),
        ("nested minimum", "min", json!(90)),
        ("nested stack", "type", json!("stack")),
        ("pane minimum", "min", json!(90)),
        ("pane maximum", "max", json!(500)),
    ] {
        let mut root = nested.clone();
        if label.starts_with("pane") {
            root["children"][0]["children"][0][field] = value;
        } else {
            root["children"][0][field] = value;
        }
        view.update_in(cx, |this, w, cx| {
            this.chrome = serde_json::from_value(layout(false, 0.)).unwrap();
            this.model.spaces[0].tabs[0].root = serde_json::from_value(root.clone()).unwrap();
            this.sync(w, cx);
        });
        draw(cx);
        let manual = bounds(cx);
        view.update(cx, |this, _| {
            this.chrome = serde_json::from_value(layout(true, 0.)).unwrap();
            let context = this.chrome.find("context").unwrap();
            assert!(this.arranged(context, &this.model.active_tab().unwrap().root, this.pane_frame()).is_none(),
                "{label}: unsupported custom trees must refuse automatic projection");
        });
        draw(cx);
        assert_eq!(bounds(cx), manual, "{label}: fallback must keep manual geometry");
        view.update(cx, |this, _| {
            assert_eq!(this.model.active_tab().unwrap().root, serde_json::from_value::<super::Node>(root.clone()).unwrap(),
                "{label}: saved structure must stay intact");
            assert_eq!(this.terms["a"].view.entity_id(), snapshot.2);
            assert_eq!(this.copies["d"].root.as_ref().unwrap().entity_id(), snapshot.3);
        });
    }
    // Large preserved insets must affect the choice, not just shrink a guessed grid afterward.
    for (position, reveal) in [("top", "always"), ("bottom", "always"), ("top", "hover")] {
        view.update_in(cx, |this, w, cx| {
            let mut chrome = layout(true, 0.);
            let context = &mut chrome["children"][1];
            context["padding"] = json!([8, 12]);
            context["border"] = json!({"width":10,"color":"border"});
            context["content"]["pane"]["border"] = json!({"width":2,"color":"border"});
            context["content"]["pane"]["focus"] = json!({"width":3,"color":"accent"});
            context["content"]["pane"]["header"] = json!({"height":35,"position":position,"reveal":reveal,"content":{"mod":"probe"}});
            this.chrome = serde_json::from_value(chrome).unwrap();
            let mut root = serde_json::to_value(&snapshot.0).unwrap();
            root["padding"] = json!([230, 12]);
            root["border"] = json!({"width":3,"color":"border"});
            for pane in root["children"].as_array_mut().unwrap() {
                pane["padding"] = json!([10, 14]);
                pane["border"] = json!({"width":2,"color":"border"});
            }
            this.model.spaces[0].tabs[0].root = serde_json::from_value(root).unwrap();
            this.sync(w, cx);
        });
        draw(cx);
        let b = bounds(cx);
        assert!(b[3].origin.y > b[0].origin.y, "width, not short content height, must require two rows");
        view.update_in(cx, |this, w, cx| {
            let tab = this.model.active_tab().unwrap();
            for pane in ["a", "b", "c"] {
                let predicted = this.shown_size(tab, pane, w).unwrap();
                let rendered = this.terms[pane].view.read(cx).dimensions();
                assert_eq!(predicted, rendered, "{pane}, {position}/{reveal}");
            }
            assert_eq!(this.terms["a"].view.entity_id(), snapshot.2);
            assert_eq!(this.copies["d"].root.as_ref().unwrap().entity_id(), snapshot.3);
        });
    }

}

use super::*;

pub(super) fn enabled(context: &Node) -> bool {
    matches!(context.content(), Some(Content::Context { arrangement: Some(crate::layout::Arrangement::Auto), .. }))
}

fn supported(node: &Node, root: bool) -> bool {
    if node.min.is_some() || node.max.is_some() || matches!(node.size, Some(Span::Px { .. })) {
        return false;
    }
    match &node.kind {
        Kind::Block { .. } => node.is_pane(),
        Kind::Row { children } | Kind::Column { children } => {
            if !root {
                // Only split ratios/dividers may disappear. Reject every other container property.
                let mut plain = Node::container(node.id.clone(), node.axis().unwrap(), children.clone());
                plain.size = node.size;
                plain.divider = node.divider.clone();
                if *node != plain { return false; }
            }
            !children.is_empty() && children.iter().all(|child| supported(child, false))
        }
        _ => false,
    }
}

impl AppWindow {
    pub(super) fn arranged(&self, context: &Node, root: &Node, frame: Option<&PaneFrame>) -> Option<Node> {
        if !enabled(context) || root.is_pane() || !supported(root, true) {
            *self.adaptive_rows.borrow_mut() = None;
            return None;
        }
        let tab = self.model.active_tab()?;
        let area = self.bounds.borrow().get(&context.id)?.size;
        let zoom = settings::zoom();
        let (y, x) = pane_size::padding(context);
        let width = f32::from(area.width) / zoom - 2.0 * x;
        let height = f32::from(area.height) / zoom - 2.0 * y;
        if width <= 0.0 || height <= 0.0 { return None; }
        let panes: Vec<_> = root.visible_blocks().into_iter().filter(|n| n.is_pane()).collect();
        let count = panes.len();
        if count < 2 {
            *self.adaptive_rows.borrow_mut() = None;
            return None;
        }
        let focused: HashSet<_> = tab.focused_pane().and_then(|id| root.path_to(&id)).unwrap_or_default().into_iter().collect();
        let area = pane_size::content_size(root, gpui::size(px(width), px(height)), focused.contains(&root.id), 1.0);
        let gap = pane_size::gap(root, frame);
        let minimum_width = |rows: usize| {
            let height = (f32::from(area.height) - gap * (rows - 1) as f32).max(0.0) / rows as f32;
            let mut offset = 0;
            let mut narrowest = f32::INFINITY;
            for row in 0..rows {
                let columns = count / rows + usize::from(row < count % rows);
                let width = (f32::from(area.width) - gap * (columns - 1) as f32).max(0.0) / columns as f32;
                for pane in &panes[offset..offset + columns] {
                    let size = pane_size::pane_size(pane, gpui::size(px(width), px(height)), &pane.id, frame, &focused, 1.0).unwrap();
                    narrowest = narrowest.min(f32::from(size.width));
                }
                offset += columns;
            }
            narrowest
        };
        let best = (1..=count).find(|&rows| minimum_width(rows) >= 360.0).unwrap_or(count);
        let membership: Vec<_> = panes.iter().map(|pane| pane.id.clone()).collect();
        let previous = self.adaptive_rows.borrow().as_ref()
            .filter(|(owner, id, members, rows)| owner == &context.id && id == &tab.id && members == &membership && *rows <= count)
            .map(|(_, _, _, rows)| *rows);
        // Expand only with a 24px margin per pane; shrinking and membership changes never wait.
        let rows = previous.filter(|old| *old > best && minimum_width(best) < 384.0).unwrap_or(best);
        *self.adaptive_rows.borrow_mut() = Some((context.id.clone(), tab.id.clone(), membership, rows));
        let mut panes = panes.into_iter();
        let mut groups = Vec::new();
        for row in 0..rows {
            let length = count / rows + usize::from(row < count % rows);
            let children = panes.by_ref().take(length).map(|pane| {
                let mut pane = pane.clone();
                pane.size = None;
                pane
            }).collect();
            let mut group = Node::container(format!("{}#auto-{row}", context.id), Axis::Row, children);
            group.gap = Some(gap);
            group.resizable = Some(false);
            groups.push(group);
        }
        let mut arranged = root.clone();
        arranged.kind = Kind::Column { children: groups };
        arranged.resizable = Some(false);
        arranged.divider = None;
        arranged.gap = Some(gap);
        Some(arranged)
    }
}

# UI Design Truth Index

这个目录是当前项目 UI 设计原型的内部真源索引。项目有既有真源约定时必须沿用，不能因为方便而新建并行目录。

字段语义、枚举、版本归属、批准资格和转换的唯一 owner 是 `references/ui-design-lifecycle.md`；本索引只消费各功能 `prototype.md` 当前记录，不定义状态机。

## 原型索引

| 功能 | 原型真源 | active version / status | approved version | implementation version / status | 最后证据 |
| --- | --- | --- | --- | --- | --- |
| <feature> | [prototype.md](prototypes/<feature>/prototype.md) | `v001` / `draft` | `pending` | `pending` / `not_started` | 未验证 |

## 目录合同

```text
design/
  README.md
  prototypes/
    <feature>/
      prototype.md
      vNNN/
        <artifact manifest 列出的真实文件>
```

- `prototype.md` 是单个功能原型记录，它按 lifecycle owner 绑定 active、approved 和 implementation version。
- `vNNN/` 只存放该版本实际需要的输出；不用固定 desktop/mobile、主题、状态或素材目录填充模板。
- 每个真实文件必须进入该版本的 artifact manifest，记录 surface、state、viewport、theme、path 和 SHA-256。
- 独立素材只能是拆解后真正需要的生产资产，并在 asset boundary map 记录格式、来源、授权与边界。

## 更新规则

- 新建或修订原型时，同步更新本索引和对应 `prototype.md`。
- 实现状态必须指向明确的 implementation version；无新鲜验证不得标记完成。
- 已批准版本和其 artifact manifest、约束审查、批准证据不得覆盖。
- 设计真源的公开性跟随上层内部真源根的隐私和 Git 规则。

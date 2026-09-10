# Bundled Design Skills Sources

[DocMap]
    层级：L2 / 来源与许可证说明
    模块：打包进仓库的设计技能来源记录
    依赖：
    - `LICENSE-ui-ux-pro-max-bundled.txt`
    - `LICENSE-impeccable-bundled.txt`
    - `NOTICE-impeccable-bundled.txt`
    输出：
    - 上游来源
    - bundled 技能清单
    - 许可证说明

## 说明

这份文件只记录 bundled 设计技能的上游来源、版本和许可证。

相关法律与来源文件统一收纳在 `docs/legal/`。

分发包里不保留本机导出路径；只保留对外需要的来源信息。

## 上游来源

| 能力组 | 上游仓库 | 版本 / 来源 | 许可证 | 备注 |
| --- | --- | --- | --- | --- |
| `ui-ux-pro-max` 侧 | `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` | `skill.json.version = 2.5.0` | MIT | 只打包页面设计主线相关技能 |
| `impeccable` 侧 | `https://github.com/pbakaus/impeccable` | `package.json.version = 2.1.7` | Apache-2.0 | 打包整套页面设计质量层技能 |

## 当前 bundled 技能

### `ui-ux-pro-max` 侧

- `skills/ui-ux-pro-max`
- `skills/design-system`
- `skills/ui-styling`
- `skills/brand`

明确不作为默认主链路入口的营销设计能力：

- `design`
- `banner-design`
- `slides`

### `impeccable` 侧

- `skills/impeccable`
- `skills/adapt`
- `skills/animate`
- `skills/audit`
- `skills/bolder`
- `skills/clarify`
- `skills/colorize`
- `skills/critique`
- `skills/delight`
- `skills/distill`
- `skills/harden`
- `skills/layout`
- `skills/optimize`
- `skills/overdrive`
- `skills/polish`
- `skills/quieter`
- `skills/shape`
- `skills/typeset`

## 法律文件

- `LICENSE-ui-ux-pro-max-bundled.txt`
- `LICENSE-impeccable-bundled.txt`
- `NOTICE-impeccable-bundled.txt`

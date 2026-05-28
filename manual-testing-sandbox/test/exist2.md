# 系统监控手册

## 监控指标

### CPU 使用率

```bash
# 查看CPU使用情况
top -bn1 | grep "Cpu(s)" | awk '{print $2}'
```

### 内存使用

```bash
# 查看内存使用
free -h | awk '/Mem:/ {print $3/$2 * 100.0"%"}'
```

## 告警阈值

| 指标      | 警告阈值 | 危险阈值 |
| --------- | -------- | -------- |
| CPU使用率 | >70%     | >90%     |
| 内存使用  | >75%     | >85%     |
| 磁盘空间  | >80%     | >95%     |

## 应急联系人

1. 系统管理员: admin@example.com
2. 数据库管理员: dba@example.com
3. 网络管理员: network@example.com

> 📞 紧急情况请拨打: 400-123-4567

*最后更新: 2024-01*test\exist3.md

# 数据管理指南

## 1. 数据备份策略

| 备份类型 | 频率   | 保留期限 |
| -------- | ------ | -------- |
| 完全备份 | 每周日 | 3个月    |
| 增量备份 | 每天   | 1个月    |
| 差异备份 | 每周三 | 2周      |

## 2. 数据清理流程

```python
def clean_data(data):
    """清理无效数据"""
    return [item for item in data if item is not None]

# 示例
raw_data = [1, None, 3, None, 5]
cleaned = clean_data(raw_data)
print(f"清理后: {cleaned}")
```

## 3. 注意事项

- ⚠️ 在清理前务必备份数据
- 🔒 确保数据删除符合GDPR规定
- 📊 定期进行数据质量审计

---

*版本: v1.0*test\exist2.md

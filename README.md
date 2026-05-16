# 人生ドラフト (Life Draft Card Game) — Web Simulator

3〜6人で集まり、人生の選択や習慣をドラフトしながら、お互いの未来を語り合い、賞を贈り合うカードゲームのWebシミュレーター。

## 🎴 ゲームの流れ

1. **未来カードドラフト** — 配られた未来カードから3枚を選ぶ
2. **プレゼン** — 1人1〜2分で「私はこんな未来を目指す」を語る
3. **受賞投票** — 8つの賞をお互いに投票で贈り合う
4. **習慣カードドラフト** — 未来に近づくための習慣を3枚選ぶ
5. **エッジマップワーク** — Kegan & Lahey の Immunity to Change を参考にした自己理解ワーク
6. **サマリー** — 全員の選択を振り返り、明日のステップを宣言

## 💻 開発

```bash
npm install
npm run dev
```

→ `http://localhost:3000` で確認

## 🚀 デプロイ

このプロジェクトは [Vercel](https://vercel.com) にデプロイされています。

## 🛠 技術

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS

## 📦 カード構成

- 未来カード 48枚（6カテゴリ）
- 習慣カード 49枚（7カテゴリ）
- エッジカード 20枚（10系統）
- 受賞カード 8枚（3pt×3、2pt×3、1pt×2）

## 📄 出典

エッジマップワークは Robert Kegan & Lisa Lahey, *Immunity to Change* (Harvard Business Review Press, 2009) の研究を参考に独自構成しています。

---

© Color Variation

'use client';

import { useState } from 'react';
import {
  FUTURE_CARDS, HABIT_CARDS, EDGE_CARDS, AWARD_CARDS,
  FUTURE_CAT_LABEL, HABIT_CAT_LABEL, FUTURE_CAT_COLOR, HABIT_CAT_COLOR,
  TIER_POINTS, shuffle,
  FutureCard, HabitCard, EdgeCard, AwardCard,
} from '@/lib/cards';

type Phase =
  | 'home'
  | 'setup'
  | 'futureIntro' | 'futureDraft' | 'futureDraftDone'
  | 'present'
  | 'voteIntro' | 'voting' | 'voteResult'
  | 'habitIntro' | 'habitDraft' | 'habitDraftDone'
  | 'edgeIntro' | 'edgeMap'
  | 'summary';

type Player = {
  name: string;
  futureDeal: FutureCard[];
  futureHand: FutureCard[];
  habitDeal: HabitCard[];
  habitHand: HabitCard[];
  edgeMap: { col1: string; col2: string; col3: string; col4: string; next: string };
  edges: EdgeCard[];
};

type AwardResult = {
  award: AwardCard;
  winner: string | null;
  votes: Record<string, number>;
};

const DRAFT_DEAL_SIZE = 8;
const DRAFT_PICK_SIZE = 3;
const EDGE_PICK_MAX = 3;

export default function Page() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentAwardIdx, setCurrentAwardIdx] = useState(0);
  const [awardResults, setAwardResults] = useState<AwardResult[]>([]);
  const [voteSelection, setVoteSelection] = useState<Record<string, string>>({});

  const startGame = (names: string[]) => {
    const shuffledFuture = shuffle(FUTURE_CARDS);
    const shuffledHabit = shuffle(HABIT_CARDS);
    const newPlayers: Player[] = names.map((name, i) => ({
      name: name.trim() || `プレイヤー${i + 1}`,
      futureDeal: shuffledFuture.slice(i * DRAFT_DEAL_SIZE, (i + 1) * DRAFT_DEAL_SIZE),
      futureHand: [],
      habitDeal: shuffledHabit.slice(i * DRAFT_DEAL_SIZE, (i + 1) * DRAFT_DEAL_SIZE),
      habitHand: [],
      edgeMap: { col1: '', col2: '', col3: '', col4: '', next: '' },
      edges: [],
    }));
    setPlayers(newPlayers);
    setCurrentIdx(0);
    setPhase('futureIntro');
  };

  const updatePlayer = (idx: number, patch: Partial<Player>) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-sky-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {phase === 'home' && <HomeScreen onStart={() => setPhase('setup')} />}
        {phase === 'setup' && <SetupScreen onStart={startGame} onBack={() => setPhase('home')} />}

        {phase === 'futureIntro' && (
          <StepIntro
            stepNum={1}
            title="未来カードドラフト"
            subtitle="今の自分に響く「未来」を選び取る"
            description={`各プレイヤーに未来カードを${DRAFT_DEAL_SIZE}枚配ります。その中から${DRAFT_PICK_SIZE}枚を選んでください。「実現可能性」より「響くかどうか」を基準に。`}
            onStart={() => setPhase('futureDraft')}
            color="from-rose-400 to-orange-400"
          />
        )}

        {phase === 'futureDraft' && players[currentIdx] && (
          <DraftStage
            kind="future"
            player={players[currentIdx]}
            playerIdx={currentIdx}
            totalPlayers={players.length}
            onComplete={(picks) => {
              updatePlayer(currentIdx, { futureHand: picks as FutureCard[] });
              if (currentIdx + 1 < players.length) {
                setCurrentIdx(currentIdx + 1);
              } else {
                setCurrentIdx(0);
                setPhase('futureDraftDone');
              }
            }}
          />
        )}

        {phase === 'futureDraftDone' && (
          <HandReveal
            players={players}
            handField="futureHand"
            title="🌈 全員の未来が出揃った！"
            onNext={() => setPhase('present')}
          />
        )}

        {phase === 'present' && (
          <PresentScreen
            players={players}
            onNext={() => {
              setCurrentAwardIdx(0);
              setAwardResults([]);
              setVoteSelection({});
              setPhase('voteIntro');
            }}
          />
        )}

        {phase === 'voteIntro' && (
          <StepIntro
            stepNum={3}
            title="未来への受賞投票"
            subtitle="お互いの未来に賞を贈り合う"
            description="8つの賞をひとつずつ読み上げます。全員で「この賞は誰?」を選んでタップしてください。"
            onStart={() => setPhase('voting')}
            color="from-amber-400 to-yellow-300"
          />
        )}

        {phase === 'voting' && (
          <VotingStage
            award={AWARD_CARDS[currentAwardIdx]}
            currentNum={currentAwardIdx + 1}
            totalAwards={AWARD_CARDS.length}
            players={players}
            selection={voteSelection}
            onSelectionChange={setVoteSelection}
            onConfirm={() => {
              const votes: Record<string, number> = {};
              players.forEach((p) => {
                const vf = voteSelection[p.name];
                if (vf) votes[vf] = (votes[vf] || 0) + 1;
              });
              let maxVotes = 0;
              let winner: string | null = null;
              Object.entries(votes).forEach(([name, count]) => {
                if (count > maxVotes) {
                  maxVotes = count;
                  winner = name;
                }
              });
              setAwardResults((prev) => [
                ...prev,
                { award: AWARD_CARDS[currentAwardIdx], winner, votes },
              ]);
              setVoteSelection({});
              if (currentAwardIdx + 1 < AWARD_CARDS.length) {
                setCurrentAwardIdx(currentAwardIdx + 1);
              } else {
                setPhase('voteResult');
              }
            }}
          />
        )}

        {phase === 'voteResult' && (
          <VoteResultScreen
            results={awardResults}
            players={players}
            onNext={() => {
              setCurrentIdx(0);
              setPhase('habitIntro');
            }}
          />
        )}

        {phase === 'habitIntro' && (
          <StepIntro
            stepNum={4}
            title="習慣カードドラフト"
            subtitle="未来に近づくための今の習慣を選ぶ"
            description={`各プレイヤーに習慣カードを${DRAFT_DEAL_SIZE}枚配ります。自分の未来カードを思い出しながら、近づくために続けたい習慣を${DRAFT_PICK_SIZE}枚選んでください。`}
            onStart={() => setPhase('habitDraft')}
            color="from-emerald-400 to-teal-400"
          />
        )}

        {phase === 'habitDraft' && players[currentIdx] && (
          <DraftStage
            kind="habit"
            player={players[currentIdx]}
            playerIdx={currentIdx}
            totalPlayers={players.length}
            futureHand={players[currentIdx].futureHand}
            onComplete={(picks) => {
              updatePlayer(currentIdx, { habitHand: picks as HabitCard[] });
              if (currentIdx + 1 < players.length) {
                setCurrentIdx(currentIdx + 1);
              } else {
                setCurrentIdx(0);
                setPhase('habitDraftDone');
              }
            }}
          />
        )}

        {phase === 'habitDraftDone' && (
          <HandReveal
            players={players}
            handField="habitHand"
            title="🌿 全員の習慣が出揃った！"
            onNext={() => setPhase('edgeIntro')}
          />
        )}

        {phase === 'edgeIntro' && (
          <StepIntro
            stepNum={5}
            title="エッジマップワーク"
            subtitle="「やりたいのにできない」の奥を見る"
            description="習慣を続けたいのに、つい後回しになる。その奥には、合理的な「守りのシステム」が働いています。4つの問いに答えて、自分のエッジを言語化しましょう。"
            onStart={() => setPhase('edgeMap')}
            color="from-indigo-500 to-slate-700"
          />
        )}

        {phase === 'edgeMap' && players[currentIdx] && (
          <EdgeMapStage
            player={players[currentIdx]}
            playerIdx={currentIdx}
            totalPlayers={players.length}
            onComplete={(em, edges) => {
              updatePlayer(currentIdx, { edgeMap: em, edges });
              if (currentIdx + 1 < players.length) {
                setCurrentIdx(currentIdx + 1);
              } else {
                setPhase('summary');
              }
            }}
          />
        )}

        {phase === 'summary' && (
          <SummaryScreen
            players={players}
            awardResults={awardResults}
            onRestart={() => {
              setPlayers([]);
              setCurrentIdx(0);
              setAwardResults([]);
              setVoteSelection({});
              setPhase('home');
            }}
          />
        )}
      </div>

      <footer className="text-center text-xs text-stone-400 mt-12 pb-4">
        人生ドラフト Web Simulator v1.0 / © Color Variation
      </footer>
    </main>
  );
}

// ============= COMPONENTS =============

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🎴</div>
      <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-rose-500 via-amber-500 to-purple-500 bg-clip-text text-transparent">
        人生ドラフト
      </h1>
      <p className="text-lg text-stone-600 mb-8">LIFE DRAFT CARD GAME</p>
      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 md:p-8 shadow-lg max-w-2xl mx-auto mb-8 text-left">
        <p className="text-stone-700 leading-relaxed mb-4">
          3〜6人で集まり、人生の選択や習慣をドラフトしながら、お互いの未来を語り合い、賞を贈り合うカードゲーム。
        </p>
        <p className="text-stone-700 leading-relaxed">
          「勝つこと」よりも「自分の人生観が見えること」「他者の生き方に触れること」を大切にする設計。
        </p>
      </div>
      <button
        onClick={onStart}
        className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition"
      >
        ゲームを始める ▶
      </button>
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm max-w-3xl mx-auto">
        <Stat icon="🌈" label="未来カード" count={FUTURE_CARDS.length} />
        <Stat icon="🌿" label="習慣カード" count={HABIT_CARDS.length} />
        <Stat icon="🛡" label="エッジカード" count={EDGE_CARDS.length} />
        <Stat icon="🏆" label="受賞カード" count={AWARD_CARDS.length} />
      </div>
    </div>
  );
}

function Stat({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="bg-white/60 rounded-xl p-3 shadow">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-stone-500 mt-1">{label}</div>
      <div className="text-lg font-bold text-stone-700">{count}枚</div>
    </div>
  );
}

function SetupScreen({ onStart, onBack }: { onStart: (names: string[]) => void; onBack: () => void }) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>(['', '', '']);

  const setN = (n: number) => {
    setCount(n);
    if (names.length < n) setNames([...names, ...Array(n - names.length).fill('')]);
    else setNames(names.slice(0, n));
  };

  return (
    <div className="py-8">
      <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">プレイヤー設定</h2>
      <p className="text-stone-600 mb-6">人数と名前を決めてください</p>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <label className="block text-sm font-bold text-stone-700 mb-2">人数</label>
        <div className="flex gap-2 mb-6 flex-wrap">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setN(n)}
              className={`w-12 h-12 rounded-full font-bold transition ${
                count === n ? 'bg-rose-500 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="block text-sm font-bold text-stone-700 mb-2">名前</label>
        <div className="space-y-2">
          {names.map((name, i) => (
            <input
              key={i}
              value={name}
              onChange={(e) => {
                const arr = [...names];
                arr[i] = e.target.value;
                setNames(arr);
              }}
              placeholder={`プレイヤー${i + 1}`}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 bg-stone-200 text-stone-700 rounded-full font-bold hover:bg-stone-300 transition">
          ← 戻る
        </button>
        <button
          onClick={() => onStart(names)}
          className="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white py-3 rounded-full font-bold shadow hover:shadow-lg transition"
        >
          スタート ▶
        </button>
      </div>
    </div>
  );
}

function StepIntro({
  stepNum, title, subtitle, description, onStart, color,
}: {
  stepNum: number;
  title: string;
  subtitle: string;
  description: string;
  onStart: () => void;
  color: string;
}) {
  return (
    <div className="text-center py-10">
      <div className={`inline-block bg-gradient-to-r ${color} text-white text-sm font-bold px-4 py-1 rounded-full mb-4`}>
        STEP {stepNum}
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2">{title}</h2>
      <p className="text-lg text-stone-600 mb-6">{subtitle}</p>
      <div className="bg-white/80 rounded-2xl p-6 max-w-2xl mx-auto mb-8 shadow">
        <p className="text-stone-700 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={onStart}
        className={`bg-gradient-to-r ${color} text-white text-lg font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition`}
      >
        始める ▶
      </button>
    </div>
  );
}

function DraftStage({
  kind, player, playerIdx, totalPlayers, futureHand, onComplete,
}: {
  kind: 'future' | 'habit';
  player: Player;
  playerIdx: number;
  totalPlayers: number;
  futureHand?: FutureCard[];
  onComplete: (picks: FutureCard[] | HabitCard[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showHandover, setShowHandover] = useState(true);

  const deal: (FutureCard | HabitCard)[] = kind === 'future' ? player.futureDeal : player.habitDeal;

  const toggle = (code: string) => {
    if (selected.includes(code)) setSelected(selected.filter((c) => c !== code));
    else if (selected.length < DRAFT_PICK_SIZE) setSelected([...selected, code]);
  };

  if (showHandover) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-6">📱</div>
        <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">{player.name} さんの番です</h2>
        <p className="text-stone-600 mb-2">({playerIdx + 1} / {totalPlayers}人目)</p>
        <p className="text-stone-600 mb-8">スマホを{player.name}さんに渡してください</p>
        <button
          onClick={() => setShowHandover(false)}
          className="bg-stone-700 text-white py-3 px-10 rounded-full font-bold shadow hover:shadow-lg transition"
        >
          確認した、始める ▶
        </button>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="text-center mb-4">
        <p className="text-sm text-stone-500">
          {player.name} さん / {kind === 'future' ? '未来カード' : '習慣カード'}を{DRAFT_PICK_SIZE}枚選んでください
        </p>
        <p className="text-3xl font-bold text-stone-800 mt-1">
          {selected.length} / {DRAFT_PICK_SIZE}
        </p>
      </div>

      {kind === 'habit' && futureHand && futureHand.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
          <div className="font-bold text-amber-900 mb-1">📌 自分が選んだ未来:</div>
          <div className="flex flex-wrap gap-2">
            {futureHand.map((c) => (
              <span key={c.code} className="bg-white px-2 py-1 rounded-full text-xs text-stone-700">
                {c.icon} {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {deal.map((card) => (
          <div
            key={card.code}
            onClick={() => toggle(card.code)}
            className={`cursor-pointer transition-all ${
              selected.includes(card.code) ? 'scale-105 ring-4 ring-rose-400 rounded-xl' : 'hover:scale-102'
            }`}
          >
            {kind === 'future' ? (
              <FutureCardView card={card as FutureCard} />
            ) : (
              <HabitCardView card={card as HabitCard} />
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-2 flex justify-center">
        <button
          disabled={selected.length !== DRAFT_PICK_SIZE}
          onClick={() => onComplete(deal.filter((c) => selected.includes(c.code)) as FutureCard[] | HabitCard[])}
          className={`px-10 py-3 rounded-full font-bold shadow-lg transition ${
            selected.length === DRAFT_PICK_SIZE ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-stone-300 text-stone-500 cursor-not-allowed'
          }`}
        >
          {selected.length === DRAFT_PICK_SIZE ? '確定して次へ ▶' : `あと ${DRAFT_PICK_SIZE - selected.length} 枚選ぶ`}
        </button>
      </div>
    </div>
  );
}

function FutureCardView({ card, compact = false }: { card: FutureCard; compact?: boolean }) {
  const c = FUTURE_CAT_COLOR[card.cat];
  return (
    <div
      className="rounded-xl overflow-hidden shadow border-2"
      style={{ borderColor: c.border, background: `linear-gradient(180deg, ${c.soft}, ${c.bg})` }}
    >
      <div
        className="px-3 py-1.5 text-xs font-bold flex justify-between"
        style={{ background: c.border, color: card.cat === 'work' ? '#4a3300' : 'white' }}
      >
        <span>{FUTURE_CAT_LABEL[card.cat]}</span>
        <span className="opacity-80 text-[10px]">{card.code}</span>
      </div>
      <div className="p-3">
        <div className="text-center text-3xl mb-2">{card.icon}</div>
        <div className="text-center font-bold mb-2" style={{ color: c.dark }}>{card.name}</div>
        {!compact && <div className="text-xs text-stone-700 leading-relaxed text-justify">{card.desc}</div>}
      </div>
    </div>
  );
}

function HabitCardView({ card, compact = false }: { card: HabitCard; compact?: boolean }) {
  const c = HABIT_CAT_COLOR[card.cat];
  return (
    <div className="rounded-xl overflow-hidden shadow border-2 bg-stone-50" style={{ borderColor: c.bg }}>
      <div
        className="px-3 py-1.5 text-xs font-bold flex justify-between"
        style={{ background: c.bg, color: card.cat === 'money' ? '#4a3300' : 'white' }}
      >
        <span>{HABIT_CAT_LABEL[card.cat]}</span>
        <span className="opacity-80 text-[10px]">{card.code}</span>
      </div>
      <div className="p-3">
        <div className="font-bold text-center mb-2" style={{ color: c.dark }}>{card.name}</div>
        {!compact && (
          <>
            <div className="text-[10px] font-bold mt-2 mb-0.5" style={{ color: c.bg }}>状況</div>
            <div className="text-xs text-stone-700 leading-relaxed mb-2">{card.sit}</div>
            <div className="text-[10px] font-bold mb-0.5" style={{ color: c.bg }}>解決</div>
            <div className="text-xs text-stone-700 leading-relaxed">{card.sol}</div>
          </>
        )}
      </div>
    </div>
  );
}

function EdgeCardView({ card, onClick, selected }: { card: EdgeCard; onClick?: () => void; selected?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl overflow-hidden shadow border-2 bg-slate-100 cursor-pointer transition ${
        selected ? 'ring-4 ring-indigo-400 scale-105' : 'hover:scale-102'
      }`}
      style={{ borderColor: '#2c3e6b' }}
    >
      <div className="px-3 py-1.5 text-white text-xs font-bold flex justify-between" style={{ background: '#2c3e6b' }}>
        <span>EDGE</span>
        <span className="opacity-80 text-[10px]">{card.code}</span>
      </div>
      <div className="p-3">
        <div className="text-center text-2xl mb-1">🛡</div>
        <div className="text-[10px] text-center text-slate-500 tracking-widest mb-1">表に出る言葉</div>
        <div className="font-bold text-center text-sm mb-2" style={{ color: '#1a2547' }}>{card.surface}</div>
        <div className="text-[10px] text-center font-bold tracking-widest mb-1" style={{ color: '#2c3e6b' }}>守っているもの</div>
        <div className="text-xs text-slate-700 leading-relaxed text-center">{card.hidden}</div>
      </div>
    </div>
  );
}

function HandReveal({
  players, handField, title, onNext,
}: {
  players: Player[];
  handField: 'futureHand' | 'habitHand';
  title: string;
  onNext: () => void;
}) {
  return (
    <div className="py-6">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-stone-800 mb-6">{title}</h2>
      <div className="space-y-6">
        {players.map((p) => (
          <div key={p.name} className="bg-white/70 rounded-2xl p-4 shadow">
            <h3 className="text-lg font-bold text-stone-800 mb-3">👤 {p.name}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {handField === 'futureHand'
                ? p.futureHand.map((card) => <FutureCardView key={card.code} card={card} />)
                : p.habitHand.map((card) => <HabitCardView key={card.code} card={card} />)
              }
            </div>
          </div>
        ))}
      </div>
      <div className="text-center mt-8">
        <button onClick={onNext} className="bg-stone-700 text-white py-3 px-10 rounded-full font-bold shadow hover:shadow-lg transition">
          次へ ▶
        </button>
      </div>
    </div>
  );
}

function PresentScreen({ players, onNext }: { players: Player[]; onNext: () => void }) {
  return (
    <div className="py-6">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-stone-800 mb-2">🎤 プレゼンタイム</h2>
      <p className="text-center text-stone-600 mb-6">
        各プレイヤーが順に1〜2分で「私はこんな未来を目指す」を語ります
      </p>
      <div className="bg-amber-50 rounded-2xl p-5 mb-6 shadow border border-amber-200">
        <h3 className="font-bold text-amber-900 mb-2">💡 語りのテンプレート</h3>
        <p className="text-stone-700 italic">「私が選んだ未来は◯◯、◯◯、◯◯です。なぜなら……」</p>
      </div>
      <div className="grid gap-3 mb-8">
        {players.map((p, i) => (
          <div key={p.name} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center font-bold text-stone-700">{i + 1}</div>
            <div className="font-bold text-stone-800">{p.name}</div>
            <div className="ml-auto flex flex-wrap gap-1">
              {p.futureHand.map((c) => (<span key={c.code} className="text-xl">{c.icon}</span>))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <button onClick={onNext} className="bg-amber-500 text-white py-3 px-10 rounded-full font-bold shadow hover:bg-amber-600 transition">
          全員のプレゼンが終わった ▶
        </button>
      </div>
    </div>
  );
}

function VotingStage({
  award, currentNum, totalAwards, players, selection, onSelectionChange, onConfirm,
}: {
  award: AwardCard;
  currentNum: number;
  totalAwards: number;
  players: Player[];
  selection: Record<string, string>;
  onSelectionChange: (s: Record<string, string>) => void;
  onConfirm: () => void;
}) {
  const tierColor = award.tier === '3pt' ? '#d99211' : award.tier === '2pt' ? '#2b6ea9' : '#b569a7';
  const allVoted = players.every((p) => selection[p.name]);

  return (
    <div className="py-6">
      <div className="text-center mb-2 text-sm text-stone-500">賞 {currentNum} / {totalAwards}</div>
      <div
        className="rounded-2xl p-6 text-center shadow-lg mb-6 text-white"
        style={{ background: `linear-gradient(135deg, ${tierColor}, ${tierColor}dd)` }}
      >
        <div className="text-xs font-bold tracking-widest mb-2">{award.tier.toUpperCase()} POINT</div>
        <div className="text-5xl mb-3">{award.icon}</div>
        <div className="text-2xl font-bold mb-2">{award.name}</div>
        <div className="text-sm opacity-95">{award.desc}</div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-stone-700 mb-3 text-sm">▼ 各プレイヤーが「この賞は誰?」を選んでください</h3>
        <div className="space-y-2">
          {players.map((voter) => (
            <div key={voter.name} className="flex items-center gap-2 flex-wrap">
              <div className="font-bold text-stone-700 w-20 sm:w-28 truncate">{voter.name}</div>
              <div className="flex flex-wrap gap-1">
                {players.map((candidate) => (
                  <button
                    key={candidate.name}
                    onClick={() => onSelectionChange({ ...selection, [voter.name]: candidate.name })}
                    className={`px-3 py-1 text-xs rounded-full transition ${
                      selection[voter.name] === candidate.name
                        ? 'bg-rose-500 text-white shadow'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {candidate.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-6">
        <button
          disabled={!allVoted}
          onClick={onConfirm}
          className={`px-10 py-3 rounded-full font-bold shadow-lg transition ${
            allVoted ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-stone-300 text-stone-500 cursor-not-allowed'
          }`}
        >
          {allVoted ? '集計して次へ ▶' : '全員の投票を待つ...'}
        </button>
      </div>
    </div>
  );
}

function VoteResultScreen({
  results, players, onNext,
}: {
  results: AwardResult[];
  players: Player[];
  onNext: () => void;
}) {
  const ptTotal: Record<string, number> = {};
  players.forEach((p) => (ptTotal[p.name] = 0));
  results.forEach((r) => { if (r.winner) ptTotal[r.winner] += TIER_POINTS[r.award.tier]; });

  const ranking = Object.entries(ptTotal).sort((a, b) => b[1] - a[1]);

  return (
    <div className="py-6">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-stone-800 mb-6">🎉 受賞結果</h2>

      <div className="bg-white rounded-2xl p-5 shadow mb-6">
        <h3 className="font-bold text-stone-700 mb-3">合計ポイント</h3>
        {ranking.map(([name, pt], i) => (
          <div key={name} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '　'}</span>
              <span className="font-bold text-stone-800">{name}</span>
            </div>
            <div className="font-bold text-amber-600">{pt} pt</div>
          </div>
        ))}
      </div>

      <div className="space-y-2 mb-6">
        {results.map((r) => (
          <div key={r.award.code} className="bg-white/80 rounded-xl p-3 shadow flex items-center gap-3">
            <div className="text-2xl">{r.award.icon}</div>
            <div className="flex-1">
              <div className="text-xs text-stone-500">{r.award.name} ({r.award.tier})</div>
              <div className="font-bold text-stone-800">{r.winner || '(投票なし)'}</div>
            </div>
            <div className="text-xs text-stone-500">
              {Object.entries(r.votes).map(([n, c]) => `${n}:${c}`).join(' ')}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <button onClick={onNext} className="bg-emerald-500 text-white py-3 px-10 rounded-full font-bold shadow hover:bg-emerald-600 transition">
          続いて習慣カードへ ▶
        </button>
      </div>
    </div>
  );
}

function EdgeMapStage({
  player, playerIdx, totalPlayers, onComplete,
}: {
  player: Player;
  playerIdx: number;
  totalPlayers: number;
  onComplete: (em: Player['edgeMap'], edges: EdgeCard[]) => void;
}) {
  const [col1, setCol1] = useState(player.edgeMap.col1);
  const [col2, setCol2] = useState(player.edgeMap.col2);
  const [col4, setCol4] = useState(player.edgeMap.col4);
  const [next, setNext] = useState(player.edgeMap.next);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [showHandover, setShowHandover] = useState(true);

  if (showHandover) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-6">📱</div>
        <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">{player.name} さんの番です</h2>
        <p className="text-stone-600 mb-2">({playerIdx + 1} / {totalPlayers}人目)</p>
        <p className="text-stone-600 mb-8">スマホを{player.name}さんに渡してください</p>
        <button
          onClick={() => setShowHandover(false)}
          className="bg-indigo-700 text-white py-3 px-10 rounded-full font-bold shadow hover:shadow-lg transition"
        >
          確認した、始める ▶
        </button>
      </div>
    );
  }

  const toggleEdge = (code: string) => {
    if (selectedEdges.includes(code)) {
      setSelectedEdges(selectedEdges.filter((c) => c !== code));
    } else if (selectedEdges.length < EDGE_PICK_MAX) {
      setSelectedEdges([...selectedEdges, code]);
    }
  };

  const col3Text = EDGE_CARDS.filter((e) => selectedEdges.includes(e.code))
    .map((e) => `${e.surface} → ${e.hidden}`)
    .join('\n');

  return (
    <div className="py-4">
      <div className="text-center mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">🛡 {player.name} さんのエッジマップ</h2>
      </div>

      <div className="bg-white rounded-xl p-4 shadow mb-3">
        <div className="text-xs font-bold tracking-widest text-emerald-600 mb-1">COL 1 / IMPROVEMENT GOAL</div>
        <h3 className="font-bold text-stone-800 mb-2">1. 取り組みたい習慣は?</h3>
        <p className="text-xs text-stone-500 mb-2">手元の習慣カードから1つ選んで書く</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {player.habitHand.map((h) => (
            <button
              key={h.code}
              onClick={() => setCol1(h.name)}
              className={`text-xs px-2 py-1 rounded-full transition ${
                col1 === h.name ? 'bg-emerald-500 text-white' : 'bg-stone-100 hover:bg-stone-200'
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
        <textarea
          value={col1}
          onChange={(e) => setCol1(e.target.value)}
          rows={2}
          placeholder="習慣を選ぶか自由記入..."
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      <div className="bg-white rounded-xl p-4 shadow mb-3">
        <div className="text-xs font-bold tracking-widest text-amber-600 mb-1">COL 2 / DOING INSTEAD</div>
        <h3 className="font-bold text-stone-800 mb-2">2. でも、やれていない行動は?</h3>
        <p className="text-xs text-stone-500 mb-2">SNSを開く、別の仕事に逃げる、先延ばし...など</p>
        <textarea
          value={col2}
          onChange={(e) => setCol2(e.target.value)}
          rows={3}
          placeholder="代わりにやっている行動を具体的に..."
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div className="bg-white rounded-xl p-4 shadow mb-3">
        <div className="text-xs font-bold tracking-widest text-purple-600 mb-1">COL 3 / HIDDEN COMMITMENT</div>
        <h3 className="font-bold text-stone-800 mb-2">3. 奥で、何を守ろうとしてる?</h3>
        <p className="text-xs text-stone-500 mb-3">エッジカードから「これは自分にもある」を最大{EDGE_PICK_MAX}枚</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3 max-h-96 overflow-y-auto">
          {EDGE_CARDS.map((e) => (
            <EdgeCardView
              key={e.code}
              card={e}
              onClick={() => toggleEdge(e.code)}
              selected={selectedEdges.includes(e.code)}
            />
          ))}
        </div>
        {selectedEdges.length > 0 && (
          <div className="bg-indigo-50 rounded-lg p-2 text-xs text-slate-700 whitespace-pre-line">{col3Text}</div>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 shadow mb-3">
        <div className="text-xs font-bold tracking-widest text-rose-600 mb-1">COL 4 / BIG ASSUMPTION</div>
        <h3 className="font-bold text-stone-800 mb-2">4. もし本気でやったら、何が怖い?</h3>
        <p className="text-xs text-stone-500 mb-2">「もし○○したら、△△になってしまう」</p>
        <textarea
          value={col4}
          onChange={(e) => setCol4(e.target.value)}
          rows={3}
          placeholder="奥にある「大きな前提」を言葉にする..."
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 shadow mb-6 border-2 border-indigo-200">
        <div className="text-xs font-bold tracking-widest text-indigo-700 mb-1">NEXT STEP</div>
        <h3 className="font-bold text-stone-800 mb-2">⭐ 明日から試す1ステップ</h3>
        <textarea
          value={next}
          onChange={(e) => setNext(e.target.value)}
          rows={2}
          placeholder="5分で始められる、小さなアクション..."
          className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="text-center">
        <button
          onClick={() =>
            onComplete(
              { col1, col2, col3: col3Text, col4, next },
              EDGE_CARDS.filter((e) => selectedEdges.includes(e.code))
            )
          }
          className="bg-indigo-700 text-white py-3 px-10 rounded-full font-bold shadow hover:bg-indigo-800 transition"
        >
          完了、次の人へ ▶
        </button>
      </div>
    </div>
  );
}

function SummaryScreen({
  players, awardResults, onRestart,
}: {
  players: Player[];
  awardResults: AwardResult[];
  onRestart: () => void;
}) {
  const ptTotal: Record<string, number> = {};
  players.forEach((p) => (ptTotal[p.name] = 0));
  awardResults.forEach((r) => { if (r.winner) ptTotal[r.winner] += TIER_POINTS[r.award.tier]; });

  return (
    <div className="py-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🎊</div>
        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2">セッション終了！</h2>
        <p className="text-stone-600">みなさん、お疲れさまでした</p>
      </div>

      <div className="space-y-6">
        {players.map((p) => {
          const pAwards = awardResults.filter((r) => r.winner === p.name);
          return (
            <div key={p.name} className="bg-white rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="text-2xl">👤</div>
                <h3 className="text-xl font-bold text-stone-800">{p.name}</h3>
                <div className="ml-auto bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-bold">
                  {ptTotal[p.name]} pt
                </div>
              </div>

              {pAwards.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-bold text-stone-500 mb-2">🏆 受賞</div>
                  <div className="flex flex-wrap gap-2">
                    {pAwards.map((r) => (
                      <span key={r.award.code} className="text-sm px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
                        {r.award.icon} {r.award.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs font-bold text-stone-500 mb-2">🌈 選んだ未来</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {p.futureHand.map((c) => (<FutureCardView key={c.code} card={c} compact />))}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold text-stone-500 mb-2">🌿 選んだ習慣</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {p.habitHand.map((c) => (<HabitCardView key={c.code} card={c} compact />))}
                </div>
              </div>

              {p.edgeMap.next && (
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
                  <div className="text-xs font-bold text-indigo-700 mb-1">⭐ 明日から試す1ステップ</div>
                  <div className="text-sm text-stone-800 whitespace-pre-line">{p.edgeMap.next}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center mt-10">
        <button onClick={onRestart} className="bg-stone-700 text-white py-3 px-10 rounded-full font-bold shadow hover:bg-stone-800 transition">
          もう一度遊ぶ ▶
        </button>
      </div>
    </div>
  );
}

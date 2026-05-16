'use client';

import { useState } from 'react';
import {
  FUTURE_CARDS, HABIT_CARDS, EDGE_CARDS, AWARD_CARDS,
  FUTURE_CAT_LABEL, HABIT_CAT_LABEL, FUTURE_CAT_COLOR, HABIT_CAT_COLOR,
  TIER_POINTS, shuffle,
  FutureCard, HabitCard, EdgeCard, AwardCard,
} from '@/lib/cards';

// ============= CONSTANTS =============
const NPC_NAMES = ['ハル', 'ミナ', 'ケン'];
const HUMAN_IDX = 0;
const N_PLAYERS = 1 + NPC_NAMES.length; // 4
const FUTURE_ROUNDS = 3;
const FUTURE_SUBROUNDS = 3;
const FUTURE_NARROW = 5; // 9 → 5
const HABIT_PICKS = 3;
const EDGE_PICK_MAX = 3;

// ============= TYPES =============
type Phase =
  | 'home' | 'setup'
  | 'futureIntro' | 'futureDraft' | 'futureNarrow'
  | 'futureReveal'
  | 'present'
  | 'voteIntro' | 'voting' | 'voteResult'
  | 'habitIntro' | 'habitDraft' | 'habitReveal'
  | 'edgeIntro' | 'edgeMap'
  | 'summary';

type Player = {
  name: string;
  isNPC: boolean;
  futureDraft: FutureCard[]; // 9
  futureHand: FutureCard[]; // narrowed 5
  habitHand: HabitCard[]; // 3
  edgeMap: { col1: string; col2: string; col3: string; col4: string; next: string };
  edges: EdgeCard[];
};

type FutureDraftState = {
  round: number; // 1..3
  subRound: number; // 1..3
  hands: FutureCard[][]; // current hand per player
  picks: FutureCard[][]; // accumulated this game
  deck: FutureCard[];
};

type HabitDraftState = {
  subRound: number; // 1..3
  hands: HabitCard[][];
  picks: HabitCard[][];
};

type AwardResult = {
  award: AwardCard;
  winner: string | null;
  votes: Record<string, number>;
};

// ============= HELPERS =============
function newDraftState(deck: FutureCard[]): FutureDraftState {
  const shuffled = shuffle(deck);
  const hands = Array.from({ length: N_PLAYERS }, (_, i) =>
    shuffled.slice(i * 5, i * 5 + 5)
  );
  return {
    round: 1,
    subRound: 1,
    hands,
    picks: Array.from({ length: N_PLAYERS }, () => []),
    deck: shuffled.slice(N_PLAYERS * 5),
  };
}

function newHabitState(): HabitDraftState {
  const shuffled = shuffle(HABIT_CARDS);
  return {
    subRound: 1,
    hands: Array.from({ length: N_PLAYERS }, (_, i) =>
      shuffled.slice(i * 5, i * 5 + 5)
    ),
    picks: Array.from({ length: N_PLAYERS }, () => []),
  };
}

// Process one sub-round: human picks, NPCs auto-pick, then pass right (i → i+1)
function processSubRound<T>(
  hands: T[][],
  picks: T[][],
  humanPickIdx: number
): { newHands: T[][]; newPicks: T[][]; leftovers: T[][] } {
  // determine pick index per player
  const pickIndices = hands.map((h, i) =>
    i === HUMAN_IDX ? humanPickIdx : Math.floor(Math.random() * h.length)
  );
  const newPicks = picks.map((p, i) => [...p, hands[i][pickIndices[i]]]);
  const remaining = hands.map((h, i) => h.filter((_, idx) => idx !== pickIndices[i]));
  // pass to right (i → i+1), so player i receives from (i-1)
  const N = hands.length;
  const newHands = remaining.map((_, i) => remaining[(i - 1 + N) % N]);
  return { newHands, newPicks, leftovers: [] };
}

// ============= MAIN COMPONENT =============
export default function Page() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [futureDraftState, setFutureDraftState] = useState<FutureDraftState | null>(null);
  const [habitDraftState, setHabitDraftState] = useState<HabitDraftState | null>(null);
  const [currentAwardIdx, setCurrentAwardIdx] = useState(0);
  const [awardResults, setAwardResults] = useState<AwardResult[]>([]);

  const startGame = (humanName: string) => {
    const newPlayers: Player[] = [
      {
        name: humanName.trim() || 'あなた',
        isNPC: false,
        futureDraft: [], futureHand: [], habitHand: [],
        edgeMap: { col1: '', col2: '', col3: '', col4: '', next: '' },
        edges: [],
      },
      ...NPC_NAMES.map((n) => ({
        name: `${n}(NPC)`,
        isNPC: true,
        futureDraft: [] as FutureCard[],
        futureHand: [] as FutureCard[],
        habitHand: [] as HabitCard[],
        edgeMap: { col1: '', col2: '', col3: '', col4: '', next: '' },
        edges: [] as EdgeCard[],
      })),
    ];
    setPlayers(newPlayers);
    setPhase('futureIntro');
  };

  // ============= FUTURE DRAFT LOGIC =============
  const startFutureDraft = () => {
    setFutureDraftState(newDraftState(FUTURE_CARDS));
    setPhase('futureDraft');
  };

  const handleFuturePick = (humanPickIdx: number) => {
    if (!futureDraftState) return;
    const { newHands, newPicks } = processSubRound(
      futureDraftState.hands,
      futureDraftState.picks,
      humanPickIdx
    );

    if (futureDraftState.subRound < FUTURE_SUBROUNDS) {
      // continue same round
      setFutureDraftState({
        ...futureDraftState,
        hands: newHands,
        picks: newPicks,
        subRound: futureDraftState.subRound + 1,
      });
    } else {
      // end of round
      if (futureDraftState.round < FUTURE_ROUNDS) {
        // discard remaining (newHands has each player's leftover 2 cards), push back to deck, shuffle
        const discards = newHands.flat();
        const newDeck = shuffle([...futureDraftState.deck, ...discards]);
        // deal next round
        const dealHands = Array.from({ length: N_PLAYERS }, (_, i) =>
          newDeck.slice(i * 5, i * 5 + 5)
        );
        setFutureDraftState({
          ...futureDraftState,
          round: futureDraftState.round + 1,
          subRound: 1,
          hands: dealHands,
          picks: newPicks,
          deck: newDeck.slice(N_PLAYERS * 5),
        });
      } else {
        // all 3 rounds done: each player has 9 picks
        setPlayers((prev) =>
          prev.map((p, i) => ({ ...p, futureDraft: newPicks[i] }))
        );
        setFutureDraftState(null);
        setPhase('futureNarrow');
      }
    }
  };

  const handleFutureNarrow = (selectedCodes: string[]) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i === HUMAN_IDX) {
          return { ...p, futureHand: p.futureDraft.filter((c) => selectedCodes.includes(c.code)) };
        } else {
          // NPC picks 5 random from their 9
          const shuffled = shuffle(p.futureDraft);
          return { ...p, futureHand: shuffled.slice(0, FUTURE_NARROW) };
        }
      })
    );
    setPhase('futureReveal');
  };

  // ============= HABIT DRAFT LOGIC =============
  const startHabitDraft = () => {
    setHabitDraftState(newHabitState());
    setPhase('habitDraft');
  };

  const handleHabitPick = (humanPickIdx: number) => {
    if (!habitDraftState) return;
    const { newHands, newPicks } = processSubRound(
      habitDraftState.hands,
      habitDraftState.picks,
      humanPickIdx
    );

    if (habitDraftState.subRound < HABIT_PICKS) {
      setHabitDraftState({
        ...habitDraftState,
        hands: newHands,
        picks: newPicks,
        subRound: habitDraftState.subRound + 1,
      });
    } else {
      // done — each player has 3 picks
      setPlayers((prev) => prev.map((p, i) => ({ ...p, habitHand: newPicks[i] })));
      setHabitDraftState(null);
      setPhase('habitReveal');
    }
  };

  // ============= VOTING LOGIC =============
  const handleVote = (humanVotedFor: string) => {
    // tally: human + NPCs random
    const votes: Record<string, number> = {};
    players.forEach((p, i) => {
      const voted = i === HUMAN_IDX
        ? humanVotedFor
        : players[Math.floor(Math.random() * players.length)].name;
      votes[voted] = (votes[voted] || 0) + 1;
    });
    let max = 0;
    let winner: string | null = null;
    Object.entries(votes).forEach(([name, count]) => {
      if (count > max) { max = count; winner = name; }
    });
    setAwardResults((prev) => [
      ...prev,
      { award: AWARD_CARDS[currentAwardIdx], winner, votes },
    ]);
    if (currentAwardIdx + 1 < AWARD_CARDS.length) {
      setCurrentAwardIdx(currentAwardIdx + 1);
    } else {
      setPhase('voteResult');
    }
  };

  // ============= RENDER =============
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-sky-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {phase === 'home' && <HomeScreen onStart={() => setPhase('setup')} />}
        {phase === 'setup' && <SetupScreen onStart={startGame} onBack={() => setPhase('home')} />}

        {phase === 'futureIntro' && (
          <StepIntro
            stepNum={1}
            title="未来カードドラフト"
            subtitle={`3ラウンドで9枚をドラフト → 5枚に絞る`}
            description={`各ラウンドで5枚配布→1枚選んで右隣に残りを渡す、を3回繰り返して3枚獲得。これを3ラウンド行って合計9枚を集めます。最後に「特に実現したい5枚」に絞り込んでください。`}
            onStart={startFutureDraft}
            color="from-rose-400 to-orange-400"
          />
        )}

        {phase === 'futureDraft' && futureDraftState && (
          <FutureDraftStage
            state={futureDraftState}
            players={players}
            onPick={handleFuturePick}
          />
        )}

        {phase === 'futureNarrow' && (
          <NarrowStage
            cards={players[HUMAN_IDX].futureDraft}
            onComplete={handleFutureNarrow}
          />
        )}

        {phase === 'futureReveal' && (
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
              setPhase('voteIntro');
            }}
          />
        )}

        {phase === 'voteIntro' && (
          <StepIntro
            stepNum={3}
            title="未来への受賞投票"
            subtitle="お互いの未来に賞を贈り合う"
            description="8つの賞をひとつずつ提示します。あなたが「この賞は誰?」と思う人を選んでください。NPCは自動で投票します。"
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
            onVote={handleVote}
          />
        )}

        {phase === 'voteResult' && (
          <VoteResultScreen
            results={awardResults}
            players={players}
            onNext={() => setPhase('habitIntro')}
          />
        )}

        {phase === 'habitIntro' && (
          <StepIntro
            stepNum={4}
            title="習慣カードドラフト"
            subtitle="未来に近づくための今の習慣を選ぶ"
            description={`5枚配布 → 1枚選んで右隣に渡す、を3回繰り返して合計3枚獲得。自分の未来カードを思い出しながら選んでください。`}
            onStart={startHabitDraft}
            color="from-emerald-400 to-teal-400"
          />
        )}

        {phase === 'habitDraft' && habitDraftState && (
          <HabitDraftStage
            state={habitDraftState}
            players={players}
            humanFutureHand={players[HUMAN_IDX].futureHand}
            onPick={handleHabitPick}
          />
        )}

        {phase === 'habitReveal' && (
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
            description="習慣を続けたいのに、つい後回しになる。その奥には合理的な「守りのシステム」が働いています。4つの問いに答えて、自分のエッジを言語化しましょう。（NPCは省略します）"
            onStart={() => setPhase('edgeMap')}
            color="from-indigo-500 to-slate-700"
          />
        )}

        {phase === 'edgeMap' && (
          <EdgeMapStage
            player={players[HUMAN_IDX]}
            onComplete={(em, edges) => {
              setPlayers((prev) =>
                prev.map((p, i) => (i === HUMAN_IDX ? { ...p, edgeMap: em, edges } : p))
              );
              setPhase('summary');
            }}
          />
        )}

        {phase === 'summary' && (
          <SummaryScreen
            players={players}
            awardResults={awardResults}
            onRestart={() => {
              setPlayers([]);
              setFutureDraftState(null);
              setHabitDraftState(null);
              setCurrentAwardIdx(0);
              setAwardResults([]);
              setPhase('home');
            }}
          />
        )}
      </div>

      <footer className="text-center text-xs text-stone-400 mt-12 pb-4">
        人生ドラフト Web Simulator v1.1 (NPC mode) / © Color Variation
      </footer>
    </main>
  );
}

// ============================================================
// HOME SCREEN
// ============================================================
function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">🎴</div>
      <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-rose-500 via-amber-500 to-purple-500 bg-clip-text text-transparent">
        人生ドラフト
      </h1>
      <p className="text-lg text-stone-600 mb-2">LIFE DRAFT CARD GAME</p>
      <p className="text-sm text-stone-500 mb-8">あなた1人 + NPC 3人で体験する4人対戦シミュレーター</p>
      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 md:p-8 shadow-lg max-w-2xl mx-auto mb-8 text-left">
        <p className="text-stone-700 leading-relaxed mb-4">
          人生の選択や習慣をドラフト形式で取り合いながら、未来を語り合うカードゲームのシミュレーター。
        </p>
        <p className="text-stone-700 leading-relaxed">
          NPCの3人（ハル・ミナ・ケン）と一緒に、人生ドラフトの全プロセスを体験できます。
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

// ============================================================
// SETUP SCREEN
// ============================================================
function SetupScreen({ onStart, onBack }: { onStart: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState('');

  return (
    <div className="py-8">
      <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">あなたの名前は?</h2>
      <p className="text-stone-600 mb-6">NPC 3人（ハル・ミナ・ケン）と一緒にプレイします</p>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <label className="block text-sm font-bold text-stone-700 mb-2">あなたの名前</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="あなた"
          className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 text-lg"
        />

        <div className="mt-6 bg-stone-50 rounded-xl p-4">
          <div className="text-xs font-bold text-stone-500 mb-2">同卓のNPC</div>
          <div className="flex flex-wrap gap-2">
            {NPC_NAMES.map((n) => (
              <span key={n} className="px-3 py-1 bg-white border border-stone-200 rounded-full text-sm">
                🤖 {n}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 bg-stone-200 text-stone-700 rounded-full font-bold hover:bg-stone-300 transition">
          ← 戻る
        </button>
        <button
          onClick={() => onStart(name)}
          className="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white py-3 rounded-full font-bold shadow hover:shadow-lg transition"
        >
          スタート ▶
        </button>
      </div>
    </div>
  );
}

// ============================================================
// STEP INTRO
// ============================================================
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
      <div className="bg-white/80 rounded-2xl p-6 max-w-2xl mx-auto mb-8 shadow text-left">
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

// ============================================================
// FUTURE DRAFT STAGE
// ============================================================
function FutureDraftStage({
  state, players, onPick,
}: {
  state: FutureDraftState;
  players: Player[];
  onPick: (idx: number) => void;
}) {
  const humanHand = state.hands[HUMAN_IDX];
  const totalPicks = state.picks[HUMAN_IDX].length;

  return (
    <div className="py-4">
      <div className="flex justify-center gap-2 mb-3">
        <Badge label={`ラウンド ${state.round} / ${FUTURE_ROUNDS}`} color="bg-rose-500" />
        <Badge label={`選択 ${state.subRound} / ${FUTURE_SUBROUNDS}`} color="bg-amber-500" />
        <Badge label={`累計 ${totalPicks} / 9`} color="bg-stone-700" />
      </div>

      <div className="text-center mb-4">
        <p className="text-sm text-stone-600">
          {humanHand.length}枚の中から1枚を選んでください
        </p>
        <p className="text-xs text-stone-500 mt-1">
          選んだ1枚はあなたの手札に。残りは右隣のNPCに渡されます
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 mb-3 text-xs">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="font-bold text-amber-900">📌 これまでのあなたの手札:</span>
          {state.picks[HUMAN_IDX].length === 0 && <span className="text-stone-500">まだなし</span>}
          {state.picks[HUMAN_IDX].map((c) => (
            <span key={c.code} className="bg-white px-2 py-0.5 rounded-full text-stone-700">
              {c.icon} {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {humanHand.map((card, idx) => (
          <div
            key={card.code + idx}
            onClick={() => onPick(idx)}
            className="cursor-pointer transition-all hover:scale-105 hover:ring-4 hover:ring-rose-400 rounded-xl"
          >
            <FutureCardView card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// NARROW STAGE (9 → 5)
// ============================================================
function NarrowStage({
  cards, onComplete,
}: {
  cards: FutureCard[];
  onComplete: (selectedCodes: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (code: string) => {
    if (selected.includes(code)) setSelected(selected.filter((c) => c !== code));
    else if (selected.length < FUTURE_NARROW) setSelected([...selected, code]);
  };

  return (
    <div className="py-4">
      <div className="text-center mb-4">
        <div className="inline-block bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm font-bold px-4 py-1 rounded-full mb-3">
          DRAFT COMPLETE
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">
          9枚のドラフト完了！
        </h2>
        <p className="text-stone-600 mb-2">
          特に実現したい <span className="text-rose-500 font-bold text-xl">{FUTURE_NARROW}枚</span> を選んでください
        </p>
        <p className="text-3xl font-bold text-stone-800 mt-1">
          {selected.length} / {FUTURE_NARROW}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {cards.map((card) => (
          <div
            key={card.code}
            onClick={() => toggle(card.code)}
            className={`cursor-pointer transition-all ${
              selected.includes(card.code) ? 'scale-105 ring-4 ring-rose-400 rounded-xl' : 'hover:scale-102'
            }`}
          >
            <FutureCardView card={card} />
          </div>
        ))}
      </div>

      <div className="sticky bottom-2 flex justify-center">
        <button
          disabled={selected.length !== FUTURE_NARROW}
          onClick={() => onComplete(selected)}
          className={`px-10 py-3 rounded-full font-bold shadow-lg transition ${
            selected.length === FUTURE_NARROW
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-stone-300 text-stone-500 cursor-not-allowed'
          }`}
        >
          {selected.length === FUTURE_NARROW
            ? '確定して次へ ▶'
            : `あと ${FUTURE_NARROW - selected.length} 枚選ぶ`}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HABIT DRAFT STAGE
// ============================================================
function HabitDraftStage({
  state, players, humanFutureHand, onPick,
}: {
  state: HabitDraftState;
  players: Player[];
  humanFutureHand: FutureCard[];
  onPick: (idx: number) => void;
}) {
  const humanHand = state.hands[HUMAN_IDX];
  const totalPicks = state.picks[HUMAN_IDX].length;

  return (
    <div className="py-4">
      <div className="flex justify-center gap-2 mb-3">
        <Badge label={`選択 ${state.subRound} / ${HABIT_PICKS}`} color="bg-emerald-500" />
        <Badge label={`累計 ${totalPicks} / ${HABIT_PICKS}`} color="bg-stone-700" />
      </div>

      <div className="text-center mb-3">
        <p className="text-sm text-stone-600">
          {humanHand.length}枚の中から1枚を選んでください
        </p>
      </div>

      {humanFutureHand.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs">
          <div className="font-bold text-amber-900 mb-1">📌 自分の未来カード:</div>
          <div className="flex flex-wrap gap-1.5">
            {humanFutureHand.map((c) => (
              <span key={c.code} className="bg-white px-2 py-0.5 rounded-full text-stone-700">
                {c.icon} {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {humanHand.map((card, idx) => (
          <div
            key={card.code + idx}
            onClick={() => onPick(idx)}
            className="cursor-pointer transition-all hover:scale-105 hover:ring-4 hover:ring-emerald-400 rounded-xl"
          >
            <HabitCardView card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`${color} text-white text-xs font-bold px-3 py-1 rounded-full`}>
      {label}
    </span>
  );
}

// ============================================================
// CARD VIEWS
// ============================================================
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

// ============================================================
// HAND REVEAL
// ============================================================
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
            <h3 className="text-lg font-bold text-stone-800 mb-3">
              {p.isNPC ? '🤖' : '👤'} {p.name}
            </h3>
            <div className={`grid gap-3 ${handField === 'futureHand' ? 'grid-cols-1 sm:grid-cols-3 md:grid-cols-5' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {handField === 'futureHand'
                ? p.futureHand.map((card) => <FutureCardView key={card.code} card={card} compact />)
                : p.habitHand.map((card) => <HabitCardView key={card.code} card={card} compact />)
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

// ============================================================
// PRESENT SCREEN
// ============================================================
function PresentScreen({ players, onNext }: { players: Player[]; onNext: () => void }) {
  return (
    <div className="py-6">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-stone-800 mb-2">🎤 プレゼンタイム</h2>
      <p className="text-center text-stone-600 mb-6">
        各プレイヤーが順に「私はこんな未来を目指す」を語ります
      </p>
      <div className="bg-amber-50 rounded-2xl p-5 mb-6 shadow border border-amber-200">
        <h3 className="font-bold text-amber-900 mb-2">💡 語りのテンプレート</h3>
        <p className="text-stone-700 italic">「私が選んだ未来は◯◯、◯◯、◯◯、◯◯、◯◯です。なぜなら……」</p>
      </div>
      <div className="grid gap-3 mb-8">
        {players.map((p, i) => (
          <div key={p.name} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center font-bold text-stone-700">{i + 1}</div>
            <div className="font-bold text-stone-800">
              {p.isNPC ? '🤖' : '👤'} {p.name}
            </div>
            <div className="ml-auto flex flex-wrap gap-1">
              {p.futureHand.map((c) => (<span key={c.code} className="text-lg">{c.icon}</span>))}
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

// ============================================================
// VOTING STAGE
// ============================================================
function VotingStage({
  award, currentNum, totalAwards, players, onVote,
}: {
  award: AwardCard;
  currentNum: number;
  totalAwards: number;
  players: Player[];
  onVote: (name: string) => void;
}) {
  const tierColor = award.tier === '3pt' ? '#d99211' : award.tier === '2pt' ? '#2b6ea9' : '#b569a7';

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
        <h3 className="font-bold text-stone-700 mb-3 text-sm">▼ あなたの投票: この賞は誰?</h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {players.map((p) => (
            <button
              key={p.name}
              onClick={() => onVote(p.name)}
              className="px-5 py-3 rounded-full font-bold transition bg-stone-100 text-stone-700 hover:bg-rose-500 hover:text-white hover:shadow-lg"
            >
              {p.isNPC ? '🤖' : '👤'} {p.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-center text-stone-400 mt-4">
          ※ NPCの投票は自動でランダムに集計されます
        </p>
      </div>
    </div>
  );
}

// ============================================================
// VOTE RESULT
// ============================================================
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

// ============================================================
// EDGE MAP STAGE
// ============================================================
function EdgeMapStage({
  player, onComplete,
}: {
  player: Player;
  onComplete: (em: Player['edgeMap'], edges: EdgeCard[]) => void;
}) {
  const [col1, setCol1] = useState(player.edgeMap.col1);
  const [col2, setCol2] = useState(player.edgeMap.col2);
  const [col4, setCol4] = useState(player.edgeMap.col4);
  const [next, setNext] = useState(player.edgeMap.next);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);

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
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">🛡 あなたのエッジマップ</h2>
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
          完了、サマリーへ ▶
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY
// ============================================================
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
        <p className="text-stone-600">お疲れさまでした</p>
      </div>

      <div className="space-y-6">
        {players.map((p) => {
          const pAwards = awardResults.filter((r) => r.winner === p.name);
          return (
            <div key={p.name} className="bg-white rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="text-2xl">{p.isNPC ? '🤖' : '👤'}</div>
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
                <div className="text-xs font-bold text-stone-500 mb-2">🌈 選んだ未来（5枚）</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {p.futureHand.map((c) => (<FutureCardView key={c.code} card={c} compact />))}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold text-stone-500 mb-2">🌿 選んだ習慣（3枚）</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {p.habitHand.map((c) => (<HabitCardView key={c.code} card={c} compact />))}
                </div>
              </div>

              {!p.isNPC && p.edgeMap.next && (
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

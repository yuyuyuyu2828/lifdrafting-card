'use client';

import { useState, useRef } from 'react';
import {
  FUTURE_CARDS, HABIT_CARDS, EDGE_CARDS, AWARD_CARDS,
  FUTURE_CAT_LABEL, HABIT_CAT_LABEL, FUTURE_CAT_COLOR, HABIT_CAT_COLOR,
  FUTURE_CAT_TONE,
  TIER_POINTS, shuffle,
  FutureCard, HabitCard, EdgeCard, AwardCard, FutureCategory,
} from '@/lib/cards';

// ============= CONSTANTS =============
const NPC_NAMES = ['ハル', 'ミナ', 'ケン'];
const HUMAN_IDX = 0;
const N_PLAYERS = 1 + NPC_NAMES.length;
const FUTURE_ROUNDS = 3;
const FUTURE_SUBROUNDS = 3;
const FUTURE_NARROW = 5;
const HABIT_PICKS = 3;
const EDGE_PICK_MAX = 3;

// ============= TYPES =============
type Phase =
  | 'home' | 'rules' | 'setup'
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
  futureDraft: FutureCard[];
  futureHand: FutureCard[];
  habitHand: HabitCard[];
  edgeMap: { col1: string; col2: string; col3: string; col4: string; next: string };
  edges: EdgeCard[];
};

type FutureDraftState = {
  round: number;
  subRound: number;
  hands: FutureCard[][];
  picks: FutureCard[][];
  deck: FutureCard[];
};

type HabitDraftState = {
  subRound: number;
  hands: HabitCard[][];
  picks: HabitCard[][];
};

type AwardResult = {
  award: AwardCard;
  winner: string | null;
  votes: Record<string, number>;
};

// ============= NPC PRESENTATION TEMPLATES =============
const PRESENT_TEMPLATES = [
  '私が選んだ未来は{names}。中でも『{star}』に強く惹かれます。{tone}、そんな人生を目指していきたい。',
  '今の自分に響いたのは{names}でした。『{star}』を起点に、{tone}という方向に進みたい。',
  '{names}を選びました。共通するのは{tone}という願い。『{star}』はその象徴的な1枚です。',
  '{names}を手元に残しました。{tone}という方向性。『{star}』はきっと、自分でもまだ言葉にできない理由で惹かれています。',
];

function generatePresentation(cards: FutureCard[], seed: number): string {
  if (cards.length === 0) return '';
  // dominant category
  const catCounts: Partial<Record<FutureCategory, number>> = {};
  cards.forEach((c) => {
    catCounts[c.cat] = (catCounts[c.cat] || 0) + 1;
  });
  const dominantCat = Object.entries(catCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as FutureCategory;
  const tone = FUTURE_CAT_TONE[dominantCat];
  const names = cards.map((c) => `『${c.name}』`).join('、');
  const star = cards[seed % cards.length].name;
  const tpl = PRESENT_TEMPLATES[seed % PRESENT_TEMPLATES.length];
  return tpl.replace('{names}', names).replace('{star}', star).replace('{tone}', tone);
}

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

function processSubRound<T>(
  hands: T[][],
  picks: T[][],
  humanPickIdx: number
): { newHands: T[][]; newPicks: T[][] } {
  const pickIndices = hands.map((h, i) =>
    i === HUMAN_IDX ? humanPickIdx : Math.floor(Math.random() * h.length)
  );
  const newPicks = picks.map((p, i) => [...p, hands[i][pickIndices[i]]]);
  const remaining = hands.map((h, i) => h.filter((_, idx) => idx !== pickIndices[i]));
  const N = hands.length;
  const newHands = remaining.map((_, i) => remaining[(i - 1 + N) % N]);
  return { newHands, newPicks };
}

// ============= MAIN COMPONENT =============
export default function Page() {
  const [phase, setPhase] = useState<Phase>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [futureDraftState, setFutureDraftState] = useState<FutureDraftState | null>(null);
  const [habitDraftState, setHabitDraftState] = useState<HabitDraftState | null>(null);
  const [currentAwardIdx, setCurrentAwardIdx] = useState(0);
  const [awardResults, setAwardResults] = useState<AwardResult[]>([]);
  const [transition, setTransition] = useState<'pass' | 'newRound' | null>(null);
  const [transitionInfo, setTransitionInfo] = useState<{ count: number; nextRound?: number }>({ count: 0 });

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
      // Show passing animation, then advance
      setTransitionInfo({ count: newHands[HUMAN_IDX].length });
      setTransition('pass');
      const savedState = futureDraftState;
      setTimeout(() => {
        setTransition(null);
        setFutureDraftState({
          ...savedState,
          hands: newHands,
          picks: newPicks,
          subRound: savedState.subRound + 1,
        });
      }, 1600);
    } else {
      if (futureDraftState.round < FUTURE_ROUNDS) {
        // Round transition animation, then deal new cards
        const savedState = futureDraftState;
        setTransitionInfo({ count: 5, nextRound: savedState.round + 1 });
        setTransition('newRound');
        setTimeout(() => {
          setTransition(null);
          const discards = newHands.flat();
          const newDeck = shuffle([...savedState.deck, ...discards]);
          const dealHands = Array.from({ length: N_PLAYERS }, (_, i) =>
            newDeck.slice(i * 5, i * 5 + 5)
          );
          setFutureDraftState({
            ...savedState,
            round: savedState.round + 1,
            subRound: 1,
            hands: dealHands,
            picks: newPicks,
            deck: newDeck.slice(N_PLAYERS * 5),
          });
        }, 2000);
      } else {
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
          const shuffled = shuffle(p.futureDraft);
          return { ...p, futureHand: shuffled.slice(0, FUTURE_NARROW) };
        }
      })
    );
    setPhase('futureReveal');
  };

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
      // Passing animation between sub-rounds
      setTransitionInfo({ count: newHands[HUMAN_IDX].length });
      setTransition('pass');
      const savedState = habitDraftState;
      setTimeout(() => {
        setTransition(null);
        setHabitDraftState({
          ...savedState,
          hands: newHands,
          picks: newPicks,
          subRound: savedState.subRound + 1,
        });
      }, 1600);
    } else {
      setPlayers((prev) => prev.map((p, i) => ({ ...p, habitHand: newPicks[i] })));
      setHabitDraftState(null);
      setPhase('habitReveal');
    }
  };

  const handleVote = (humanVotedFor: string) => {
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-sky-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {phase === 'home' && <HomeScreen onStart={() => setPhase('rules')} />}
        {phase === 'rules' && <RulesScreen onNext={() => setPhase('setup')} onBack={() => setPhase('home')} />}
        {phase === 'setup' && <SetupScreen onStart={startGame} onBack={() => setPhase('rules')} />}

        {phase === 'futureIntro' && (
          <StepIntro
            stepNum={1}
            title="未来カードドラフト"
            subtitle="3ラウンドで9枚をドラフト → 5枚に絞る"
            description="各ラウンドで5枚配布→1枚選んで右隣に残りを渡す、を3回繰り返して3枚獲得。これを3ラウンド行って合計9枚を集めます。最後に「特に実現したい5枚」に絞り込んでください。"
            criteria="こんな未来に心が動くかで直感的に選んでください。"
            onStart={startFutureDraft}
            color="from-rose-400 to-orange-400"
          />
        )}

        {phase === 'futureDraft' && futureDraftState && (
          <FutureDraftStage
            state={futureDraftState}
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
            criteria="プレゼン内容を思い出して『この賞はこの人にピッタリ』と感じた人を直感で選んでください。考えすぎず、響いた相手に贈るのがコツです。"
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
            subtitle="未来を実現するためのアクションを選ぶ"
            description="5枚配布 → 1枚選んで右隣に渡す、を3回繰り返して合計3枚獲得。ドラフト中、画面上部の未来カードをクリックすると内容を見返せます。"
            criteria="自分の未来カードに近づくためのアクションを選びましょう。「これが続いたら、あの未来に1歩近づく」と思える1枚を。"
            onStart={startHabitDraft}
            color="from-emerald-400 to-teal-400"
          />
        )}

        {phase === 'habitDraft' && habitDraftState && (
          <HabitDraftStage
            state={habitDraftState}
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
            criteria="正解はありません。書きながら自分の中の本音に気づくことが目的のワークです。完璧に書こうとせず、思いついたままでOK。"
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
        人生ドラフト Web Simulator v1.6 / © Color Variation
      </footer>

      {/* Transition overlays */}
      {transition === 'pass' && (
        <PassAnimation
          players={players}
          humanIdx={HUMAN_IDX}
          count={transitionInfo.count}
        />
      )}
      {transition === 'newRound' && (
        <NewRoundAnimation nextRound={transitionInfo.nextRound ?? 1} />
      )}
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
// RULES SCREEN (初プレイヤー向けゲーム説明)
// ============================================================
function RulesScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const steps = [
    {
      no: 1, color: 'from-rose-400 to-orange-400', icon: '🌈',
      title: '未来カードドラフト（5分）',
      desc: '配られた5枚から1枚選んで右隣に残りを渡す → これを繰り返して合計9枚を集めます。',
      tip: '実現可能性は考えなくてOK。「今の自分に響くか」「いいなと感じるか」で直感的に選んでください。',
    },
    {
      no: 2, color: 'from-rose-500 to-amber-500', icon: '✨',
      title: '9枚から5枚に絞る（2分）',
      desc: '集めた9枚を見比べて、「特に実現したい」5枚に絞り込みます。',
      tip: '優先順位を意識して、本当に大事だと思うものを残しましょう。',
    },
    {
      no: 3, color: 'from-amber-400 to-yellow-300', icon: '🎤',
      title: 'プレゼン＋受賞投票（5分）',
      desc: '各プレイヤーが自分の未来を1〜2分で語り、8つの賞をお互いに贈り合います。',
      tip: 'プレゼンを聞いて「この賞はこの人にピッタリ」と感じた人を直感で選んでください。',
    },
    {
      no: 4, color: 'from-emerald-400 to-teal-400', icon: '🌿',
      title: '習慣カードドラフト（3分）',
      desc: '未来に近づくための「今のアクション」を3枚選びます。同じドラフト方式で進めます。',
      tip: '自分が選んだ未来カードを思い出しながら、それに近づくアクションを選んでください。',
    },
    {
      no: 5, color: 'from-indigo-500 to-slate-700', icon: '🛡',
      title: 'エッジマップワーク（5分）',
      desc: '「やりたいのにできない」の奥に何があるか、4つの問いで自分を見つめるワーク。',
      tip: '正解はありません。書きながら自分の本音に気づくことが目的です。',
    },
  ];

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">📖</div>
        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2">ゲームのルール</h2>
        <p className="text-stone-600">初めての方も、まずはここを読めばOK</p>
      </div>

      {/* What is this game */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-5">
        <h3 className="font-bold text-stone-800 text-lg mb-2">🎴 どんなゲーム?</h3>
        <p className="text-stone-700 leading-relaxed">
          人生で選びたい <span className="font-bold text-rose-500">「未来」</span> と、それを実現する <span className="font-bold text-emerald-500">「習慣」</span> を、4人（あなた＋NPC3人）でドラフト形式で取り合います。お互いの選択を語り合い、賞を贈り合うことで、自分の人生観が浮かび上がってきます。
        </p>
        <p className="text-stone-600 leading-relaxed mt-2 text-sm">
          所要時間: <span className="font-bold">約15〜20分</span> / プレイ人数: あなた1人 + NPC3人
        </p>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-5">
        <h3 className="font-bold text-stone-800 text-lg mb-4">📋 ゲームの流れ</h3>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.no} className="border-l-4 pl-4" style={{ borderColor: s.no === 1 ? '#ea545f' : s.no === 2 ? '#efad1d' : s.no === 3 ? '#f59e0b' : s.no === 4 ? '#10b981' : '#6366f1' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`bg-gradient-to-r ${s.color} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>STEP {s.no}</span>
                <span className="text-lg">{s.icon}</span>
                <span className="font-bold text-stone-800">{s.title}</span>
              </div>
              <p className="text-sm text-stone-700 leading-relaxed mb-1">{s.desc}</p>
              <p className="text-xs text-stone-500 leading-relaxed bg-amber-50 px-2 py-1 rounded">
                <span className="font-bold text-amber-700">💡 選び方:</span> {s.tip}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Mindset */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-6 mb-5 border-2 border-indigo-100">
        <h3 className="font-bold text-stone-800 text-lg mb-3">🌟 大事な3つのこと</h3>
        <ul className="space-y-2 text-stone-700">
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">①</span>
            <span><b>「正解はない」</b> ── 考えすぎず、直感で選んでOK</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">②</span>
            <span><b>他の人の選択も全部「その人らしさ」</b> ── 比較せず、それぞれの未来を尊重</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-500 font-bold">③</span>
            <span><b>勝ち負けは目的じゃない</b> ── 自分の人生観が見えることが目的</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 bg-stone-200 text-stone-700 rounded-full font-bold hover:bg-stone-300 transition">
          ← 戻る
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white py-3 rounded-full font-bold shadow hover:shadow-lg transition"
        >
          わかった、始める ▶
        </button>
      </div>
    </div>
  );
}

// ============================================================
// STEP INTRO
// ============================================================
function StepIntro({
  stepNum, title, subtitle, description, criteria, onStart, color,
}: {
  stepNum: number;
  title: string;
  subtitle: string;
  description: string;
  criteria?: string;
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
      <div className="bg-white/80 rounded-2xl p-6 max-w-2xl mx-auto mb-4 shadow text-left">
        <div className="text-xs font-bold text-stone-500 mb-1 tracking-widest">▼ ルール</div>
        <p className="text-stone-700 leading-relaxed">{description}</p>
      </div>
      {criteria && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-2xl mx-auto mb-8 shadow text-left">
          <div className="text-xs font-bold text-amber-700 mb-1 tracking-widest">💡 選び方のコツ</div>
          <p className="text-stone-700 leading-relaxed">{criteria}</p>
        </div>
      )}
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
  state, onPick,
}: {
  state: FutureDraftState;
  onPick: (idx: number) => void;
}) {
  const humanHand = state.hands[HUMAN_IDX];
  const totalPicks = state.picks[HUMAN_IDX].length;

  return (
    <div className="py-4">
      <div className="flex justify-center gap-2 mb-3 flex-wrap">
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

      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3 text-xs text-rose-900">
        <span className="font-bold">💡 選び方のヒント:</span> 直感で「これ、いいな」と思う1枚を選んでください。考えすぎないのがコツ。
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
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mt-4 mx-auto max-w-xl text-xs text-rose-900 text-left">
          <span className="font-bold">💡 絞り方のヒント:</span> 9枚を見比べて「本当に実現したい」と感じる5枚を選びましょう。優先順位を意識する時間です。
        </div>
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
// HABIT DRAFT STAGE (with clickable future cards)
// ============================================================
function HabitDraftStage({
  state, humanFutureHand, onPick,
}: {
  state: HabitDraftState;
  humanFutureHand: FutureCard[];
  onPick: (idx: number) => void;
}) {
  const humanHand = state.hands[HUMAN_IDX];
  const totalPicks = state.picks[HUMAN_IDX].length;
  const [modalCard, setModalCard] = useState<FutureCard | null>(null);

  return (
    <div className="py-4">
      <div className="flex justify-center gap-2 mb-3 flex-wrap">
        <Badge label={`選択 ${state.subRound} / ${HABIT_PICKS}`} color="bg-emerald-500" />
        <Badge label={`累計 ${totalPicks} / ${HABIT_PICKS}`} color="bg-stone-700" />
      </div>

      <div className="text-center mb-3">
        <p className="text-sm text-stone-600">
          {humanHand.length}枚の中から1枚を選んでください
        </p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 text-xs text-emerald-900">
        <span className="font-bold">💡 選び方のヒント:</span> 下の未来カード（クリックで詳細表示）を思い出しながら、「これが続いたら、あの未来に1歩近づく」と思える習慣を選んでください。
      </div>

      {humanFutureHand.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="font-bold text-amber-900 mb-2 text-xs">
            📌 自分の未来カード <span className="font-normal text-amber-700">（クリックで詳細表示）</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {humanFutureHand.map((c) => (
              <button
                key={c.code}
                onClick={() => setModalCard(c)}
                className="bg-white hover:bg-amber-100 px-3 py-1 rounded-full text-xs text-stone-700 border border-amber-200 transition cursor-pointer flex items-center gap-1"
              >
                <span className="text-base">{c.icon}</span>
                <span>{c.name}</span>
                <span className="text-amber-500 text-[10px] ml-1">▶</span>
              </button>
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

      {modalCard && <FutureCardModal card={modalCard} onClose={() => setModalCard(null)} />}
    </div>
  );
}

// ============================================================
// PASS / NEW ROUND ANIMATIONS
// ============================================================
function PassAnimation({ players, humanIdx, count }: {
  players: Player[];
  humanIdx: number;
  count: number;
}) {
  const leftName = players[(humanIdx - 1 + players.length) % players.length].name.replace('(NPC)', '');
  const rightName = players[(humanIdx + 1) % players.length].name.replace('(NPC)', '');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-6xl mb-3 inline-block animate-bounce">🔄</div>
          <h3 className="text-xl md:text-2xl font-bold text-stone-800 mb-1">
            カードを交換中...
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            全員が同時に「残った手札を右隣に渡し、<br/>左隣から新しい手札を受け取る」
          </p>
        </div>

        <div className="bg-stone-50 rounded-2xl p-3 mb-4 overflow-x-auto">
          <div className="flex items-center justify-center gap-1 min-w-max">
            {players.map((p, i) => (
              <div key={p.name} className="flex items-center gap-1">
                <div className={`text-center px-2 py-2 rounded-lg ${i === humanIdx ? 'bg-rose-100 ring-2 ring-rose-400' : 'bg-white border border-stone-200'}`}>
                  <div className="text-2xl leading-none">{p.isNPC ? '🤖' : '👤'}</div>
                  <div className="text-[9px] font-bold text-stone-700 whitespace-nowrap mt-1">
                    {p.name.replace('(NPC)','')}
                  </div>
                </div>
                <div className="text-xl text-rose-500 animate-pulse">→</div>
              </div>
            ))}
            <div className="text-base text-stone-400">↺</div>
          </div>
          <div className="text-[10px] text-center text-stone-500 mt-1">↺ 最後の人は最初の人へ</div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-rose-50 rounded-xl p-3 border border-rose-200 text-center">
            <div className="text-[10px] text-rose-700 font-bold mb-0.5">→ 右隣へ</div>
            <div className="font-bold text-stone-800">{rightName}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-center">
            <div className="text-[10px] text-emerald-700 font-bold mb-0.5">← 左隣から</div>
            <div className="font-bold text-stone-800">{leftName}</div>
            <div className="text-xs text-emerald-700 mt-0.5">{count}枚 ✨</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewRoundAnimation({ nextRound }: { nextRound: number }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
        <div className="text-6xl mb-4 inline-block animate-bounce">🎴</div>
        <h3 className="text-2xl font-bold text-stone-800 mb-3">
          ラウンド完了！
        </h3>
        <p className="text-stone-600 mb-4 leading-relaxed text-sm">
          残った手札はデッキへ戻ります。<br/>
          ラウンド <span className="font-bold text-rose-500 text-lg">{nextRound}</span> の新しい5枚を配ります...
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="inline-block w-2 h-2 bg-rose-400 rounded-full animate-bounce"></span>
          <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
          <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FUTURE CARD MODAL (for habit draft)
// ============================================================
function FutureCardModal({ card, onClose }: { card: FutureCard; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <FutureCardView card={card} />
        <button
          onClick={onClose}
          className="mt-4 w-full bg-white text-stone-800 py-3 rounded-full font-bold shadow hover:bg-stone-100 transition"
        >
          閉じる
        </button>
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
            <div className="text-[10px] font-bold mt-2 mb-0.5" style={{ color: c.bg }}>意味 / WHY</div>
            <div className="text-xs text-stone-700 leading-relaxed mb-2">{card.sit}</div>
            <div className="text-[10px] font-bold mb-0.5" style={{ color: c.bg }}>アクション / ACTION</div>
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
// PRESENT SCREEN — NPCs also get presentation text
// ============================================================
function PresentScreen({ players, onNext }: { players: Player[]; onNext: () => void }) {
  return (
    <div className="py-6">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-stone-800 mb-2">🎤 プレゼンタイム</h2>
      <p className="text-center text-stone-600 mb-6">
        各プレイヤーが順に「私はこんな未来を目指す」を語ります
      </p>
      <div className="bg-amber-50 rounded-2xl p-5 mb-6 shadow border border-amber-200">
        <h3 className="font-bold text-amber-900 mb-2">💡 あなたの語りのテンプレート</h3>
        <p className="text-stone-700 italic text-sm">
          「私が選んだ未来は◯◯、◯◯、◯◯、◯◯、◯◯です。なぜなら……」
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {players.map((p, i) => {
          const presentText = generatePresentation(p.futureHand, i);
          return (
            <div key={p.name} className="bg-white rounded-2xl p-4 shadow border border-stone-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 bg-stone-200 rounded-full flex items-center justify-center font-bold text-stone-700 text-sm">{i + 1}</div>
                <div className="font-bold text-stone-800 flex-1">
                  {p.isNPC ? '🤖' : '👤'} {p.name}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {p.futureHand.map((c) => (<span key={c.code} className="text-lg">{c.icon}</span>))}
                </div>
              </div>
              <div className="bg-stone-50 rounded-xl p-3">
                <p className="text-sm text-stone-700 leading-relaxed">
                  {p.isNPC ? (
                    <span>「{presentText}」</span>
                  ) : (
                    <span className="text-stone-500 italic">
                      あなたの番です。手元のカードを並べて、上のテンプレートを参考に語ってみてください。
                      <br />
                      <span className="text-xs">（参考: 「{presentText}」のように語れます）</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
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
        <h3 className="font-bold text-stone-700 mb-2 text-sm">▼ あなたの投票: この賞は誰?</h3>
        <p className="text-xs text-stone-500 mb-3">
          💡 プレゼンを思い出して「この賞はこの人だ」と感じた人を直感で選んでください。自分自身に投票してもOK。
        </p>
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

  const humanRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const humanPlayer = players[HUMAN_IDX];
  const humanAwards = awardResults.filter((r) => r.winner === humanPlayer.name);
  const humanPresentText = generatePresentation(humanPlayer.futureHand, HUMAN_IDX);
  const humanPt = ptTotal[humanPlayer.name];

  async function handleDownloadPDF() {
    if (!pdfRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const html2canvasMod = await import('html2canvas-pro');
      const html2canvas = html2canvasMod.default;
      const jsPDFMod = await import('jspdf');
      const { jsPDF } = jsPDFMod;

      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      let imgWidth = pdfWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Fit to single A4 page: scale by height if too tall
      if (imgHeight > pdfHeight) {
        imgHeight = pdfHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }

      // Center on page
      const xOffset = (pdfWidth - imgWidth) / 2;
      const yOffset = (pdfHeight - imgHeight) / 2;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);

      const today = new Date().toISOString().slice(0, 10);
      const safeName = humanPlayer.name.replace(/[\\/:*?"<>|]/g, '_');
      pdf.save(`life-draft_${safeName}_${today}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDFの生成に失敗しました。もう一度お試しください。');
    } finally {
      setPdfLoading(false);
    }
  }

  const npcPlayers = players.map((p, i) => ({ p, i })).filter(({ i }) => i !== HUMAN_IDX);

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🎊</div>
        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2">セッション終了！</h2>
        <p className="text-stone-600">お疲れさまでした</p>
      </div>

      {/* PDF DOWNLOAD BUTTON */}
      <div className="text-center mb-6">
        <button
          onClick={handleDownloadPDF}
          disabled={pdfLoading}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition ${
            pdfLoading
              ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
              : 'bg-rose-500 text-white hover:bg-rose-600 hover:shadow-xl'
          }`}
        >
          {pdfLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-stone-500 border-t-transparent rounded-full animate-spin"></span>
              PDF生成中...
            </>
          ) : (
            <>📄 あなたの結果をPDFでダウンロード</>
          )}
        </button>
        <p className="text-xs text-stone-400 mt-2">あなた（{humanPlayer.name}）の選択をA4 PDFとして保存できます</p>
      </div>

      <div className="space-y-6">
        {/* HUMAN PLAYER — captured by ref for PDF */}
        <div ref={humanRef} className="bg-white rounded-2xl p-5 shadow-lg border-2 border-rose-300">
          <div className="text-center mb-4 pb-3 border-b">
            <div className="text-xs text-stone-500 tracking-widest mb-1">LIFE DRAFT — YOUR RESULTS</div>
            <div className="text-lg font-bold text-stone-800">👤 {humanPlayer.name}</div>
            <div className="text-xs text-stone-500 mt-1">{new Date().toLocaleDateString('ja-JP')}</div>
            <div className="inline-block mt-2 bg-amber-100 text-amber-800 px-4 py-1 rounded-full text-sm font-bold">
              受賞ポイント: {humanPt} pt
            </div>
          </div>

          {humanAwards.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-stone-500 mb-2">🏆 受賞</div>
              <div className="flex flex-wrap gap-2">
                {humanAwards.map((r) => (
                  <span key={r.award.code} className="text-sm px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
                    {r.award.icon} {r.award.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 bg-stone-50 rounded-xl p-3">
            <div className="text-xs font-bold text-stone-500 mb-1">💬 プレゼン（参考）</div>
            <p className="text-sm text-stone-700 leading-relaxed">「{humanPresentText}」</p>
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold text-stone-500 mb-2">🌈 選んだ未来（5枚）</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {humanPlayer.futureHand.map((c) => (<FutureCardView key={c.code} card={c} />))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-bold text-stone-500 mb-2">🌿 選んだ習慣（3枚）</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {humanPlayer.habitHand.map((c) => (<HabitCardView key={c.code} card={c} />))}
            </div>
          </div>

          {(humanPlayer.edgeMap.col1 || humanPlayer.edgeMap.col2 || humanPlayer.edgeMap.col4 || humanPlayer.edges.length > 0) && (
            <div className="mb-4 bg-indigo-50 rounded-xl p-4 border border-indigo-200">
              <div className="text-xs font-bold text-indigo-700 mb-2 tracking-widest">🛡 エッジマップ</div>
              <div className="space-y-2 text-sm">
                {humanPlayer.edgeMap.col1 && (
                  <div>
                    <span className="text-xs font-bold text-emerald-600">1. 取り組みたい習慣:</span>
                    <div className="text-stone-800 mt-0.5">{humanPlayer.edgeMap.col1}</div>
                  </div>
                )}
                {humanPlayer.edgeMap.col2 && (
                  <div>
                    <span className="text-xs font-bold text-amber-600">2. やれていない行動:</span>
                    <div className="text-stone-800 mt-0.5 whitespace-pre-line">{humanPlayer.edgeMap.col2}</div>
                  </div>
                )}
                {humanPlayer.edges.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-purple-600">3. 守ろうとしているもの:</span>
                    <div className="mt-0.5 space-y-1">
                      {humanPlayer.edges.map((e) => (
                        <div key={e.code} className="text-stone-800 text-xs">
                          ・<span className="font-bold">{e.surface}</span> → {e.hidden}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {humanPlayer.edgeMap.col4 && (
                  <div>
                    <span className="text-xs font-bold text-rose-600">4. 大きな前提:</span>
                    <div className="text-stone-800 mt-0.5 whitespace-pre-line">{humanPlayer.edgeMap.col4}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {humanPlayer.edgeMap.next && (
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl p-4 border-2 border-indigo-300">
              <div className="text-xs font-bold text-indigo-700 mb-1">⭐ 明日から試す1ステップ</div>
              <div className="text-base text-stone-800 whitespace-pre-line font-bold">{humanPlayer.edgeMap.next}</div>
            </div>
          )}
        </div>

        {/* NPC PLAYERS — full card details, not in PDF */}
        {npcPlayers.map(({ p, i }) => {
          const pAwards = awardResults.filter((r) => r.winner === p.name);
          const presentText = generatePresentation(p.futureHand, i);
          return (
            <div key={p.name} className="bg-white rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="text-2xl">🤖</div>
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

              <div className="mb-4 bg-stone-50 rounded-xl p-3">
                <div className="text-xs font-bold text-stone-500 mb-1">💬 プレゼン</div>
                <p className="text-sm text-stone-700 leading-relaxed">「{presentText}」</p>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold text-stone-500 mb-2">🌈 選んだ未来（5枚）</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {p.futureHand.map((c) => (<FutureCardView key={c.code} card={c} />))}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold text-stone-500 mb-2">🌿 選んだ習慣（3枚）</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {p.habitHand.map((c) => (<HabitCardView key={c.code} card={c} />))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-10">
        <button onClick={onRestart} className="bg-stone-700 text-white py-3 px-10 rounded-full font-bold shadow hover:bg-stone-800 transition">
          もう一度遊ぶ ▶
        </button>
      </div>

      {/* Hidden PDF layout — captured for download, never visible */}
      <PDFLayout
        pdfRef={pdfRef}
        player={humanPlayer}
        awards={humanAwards}
        points={humanPt}
        presentText={humanPresentText}
      />
    </div>
  );
}


// ============================================================
// PDF LAYOUT (hidden off-screen, captured for download)
// A4 portrait 210x297mm = 794x1123px at 96dpi
// ============================================================
function PDFLayout({
  pdfRef, player, awards, points, presentText,
}: {
  pdfRef: React.RefObject<HTMLDivElement | null>;
  player: Player;
  awards: AwardResult[];
  points: number;
  presentText: string;
}) {
  const today = new Date().toLocaleDateString('ja-JP');

  return (
    <div
      ref={pdfRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '0',
        width: '780px',
        backgroundColor: '#ffffff',
        padding: '24px',
        fontFamily: '"Hiragino Sans", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
        color: '#262626',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{
        textAlign: 'center',
        borderBottom: '2px solid #ea545f',
        paddingBottom: '10px',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '9px', color: '#999', letterSpacing: '0.25em', marginBottom: '4px' }}>
          LIFE DRAFT — YOUR RESULTS
        </div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: '1.2' }}>
          👤 {player.name}
        </div>
        <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>{today}</div>
        <div style={{
          display: 'inline-block',
          marginTop: '6px',
          backgroundColor: '#fef3c7',
          color: '#92400e',
          padding: '4px 16px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}>
          受賞ポイント: {points} pt
        </div>
      </div>

      {/* Awards */}
      {awards.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>
            🏆 受賞
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {awards.map((r) => (
              <span
                key={r.award.code}
                style={{
                  fontSize: '10px',
                  padding: '2px 9px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '9999px',
                }}
              >
                {r.award.icon} {r.award.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Presentation */}
      <div style={{
        backgroundColor: '#f5f5f4',
        borderRadius: '8px',
        padding: '8px 10px',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '3px' }}>
          💬 プレゼン
        </div>
        <div style={{ fontSize: '10px', color: '#333', lineHeight: '1.5' }}>
          「{presentText}」
        </div>
      </div>

      {/* Future cards */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>
          🌈 選んだ未来（5枚）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {player.futureHand.map((c) => {
            const col = FUTURE_CAT_COLOR[c.cat];
            return (
              <div key={c.code} style={{
                border: `1.5px solid ${col.border}`,
                background: col.bg,
                borderRadius: '6px',
                padding: '5px 6px',
                overflow: 'hidden',
              }}>
                <div style={{ textAlign: 'center', fontSize: '16px', lineHeight: '1', marginBottom: '2px' }}>
                  {c.icon}
                </div>
                <div style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: col.dark,
                  marginBottom: '3px',
                  lineHeight: '1.2',
                }}>
                  {c.name}
                </div>
                <div style={{ fontSize: '8px', lineHeight: '1.35', color: '#333' }}>
                  {c.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Habit cards */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>
          🌿 選んだ習慣（3枚）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
          {player.habitHand.map((c) => {
            const col = HABIT_CAT_COLOR[c.cat];
            return (
              <div key={c.code} style={{
                border: `1.5px solid ${col.bg}`,
                background: '#fafaf9',
                borderRadius: '6px',
                padding: '5px 6px',
                overflow: 'hidden',
              }}>
                <div style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: col.dark,
                  marginBottom: '4px',
                  lineHeight: '1.2',
                }}>
                  {c.name}
                </div>
                <div style={{ fontSize: '7px', color: col.bg, fontWeight: 'bold', marginBottom: '1px' }}>意味</div>
                <div style={{ fontSize: '8px', lineHeight: '1.35', color: '#333', marginBottom: '3px' }}>
                  {c.sit}
                </div>
                <div style={{ fontSize: '7px', color: col.bg, fontWeight: 'bold', marginBottom: '1px' }}>アクション</div>
                <div style={{ fontSize: '8px', lineHeight: '1.35', color: '#333' }}>
                  {c.sol}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edge map */}
      {(player.edgeMap.col1 || player.edgeMap.col2 || player.edgeMap.col4 || player.edges.length > 0) && (
        <div style={{
          backgroundColor: '#eef2ff',
          borderRadius: '8px',
          padding: '8px 10px',
          border: '1px solid #c7d2fe',
          marginBottom: '8px',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#4338ca',
            marginBottom: '5px',
            letterSpacing: '0.1em',
          }}>
            🛡 エッジマップ
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '9px',
          }}>
            {player.edgeMap.col1 && (
              <div>
                <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#059669', marginBottom: '2px' }}>
                  1. 取り組みたい習慣
                </div>
                <div style={{ color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{player.edgeMap.col1}</div>
              </div>
            )}
            {player.edgeMap.col2 && (
              <div>
                <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#d97706', marginBottom: '2px' }}>
                  2. やれていない行動
                </div>
                <div style={{ color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{player.edgeMap.col2}</div>
              </div>
            )}
            {player.edges.length > 0 && (
              <div>
                <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#9333ea', marginBottom: '2px' }}>
                  3. 守ろうとしているもの
                </div>
                {player.edges.map((e) => (
                  <div key={e.code} style={{ color: '#333', fontSize: '8px', marginBottom: '2px', lineHeight: '1.35' }}>
                    ・<b>{e.surface}</b> → {e.hidden}
                  </div>
                ))}
              </div>
            )}
            {player.edgeMap.col4 && (
              <div>
                <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#e11d48', marginBottom: '2px' }}>
                  4. 大きな前提
                </div>
                <div style={{ color: '#333', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{player.edgeMap.col4}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next step */}
      {player.edgeMap.next && (
        <div style={{
          background: 'linear-gradient(135deg, #e0e7ff, #f3e8ff)',
          borderRadius: '8px',
          padding: '9px 12px',
          border: '2px solid #a5b4fc',
        }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#4338ca', marginBottom: '3px' }}>
            ⭐ 明日から試す1ステップ
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#1c1917',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4',
          }}>
            {player.edgeMap.next}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '12px',
        paddingTop: '8px',
        borderTop: '1px solid #eee',
        textAlign: 'center',
        fontSize: '8px',
        color: '#aaa',
      }}>
        LIFE DRAFT CARD GAME · 人生ドラフト · © Color Variation
      </div>
    </div>
  );
}

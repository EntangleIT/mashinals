import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  STARTERS,
  childIdFromRecipe,
  mashCharacters,
  type MashinalRecord,
  type Recipe,
} from '@mashinals/shared';

interface MashState {
  discovered: Record<string, MashinalRecord>;
  recipes: Record<string, Recipe>;
  slotA: string | null;
  slotB: string | null;
  lastResultId: string | null;
  lastWasNew: boolean;
  wallet: {
    connected: boolean;
    paymentAddress: string | null;
    ordinalAddress: string | null;
    provider: string | null;
  };
  hydrateStarters: () => void;
  selectForSlot: (id: string) => void;
  setSlot: (slot: 'A' | 'B', id: string | null) => void;
  clearSlots: () => void;
  mash: () => MashinalRecord | null;
  markInscribed: (
    id: string,
    data: { origin: string; txid: string; demo: boolean; svgHash: string },
  ) => void;
  setWallet: (w: MashState['wallet']) => void;
  disconnectWallet: () => void;
}

function starterMap(): Record<string, MashinalRecord> {
  const map: Record<string, MashinalRecord> = {};
  for (const s of STARTERS) map[s.id] = { ...s, discoveredAt: Date.now() };
  return map;
}

export const useMashStore = create<MashState>()(
  persist(
    (set, get) => ({
      discovered: starterMap(),
      recipes: {},
      slotA: null,
      slotB: null,
      lastResultId: null,
      lastWasNew: false,
      wallet: {
        connected: false,
        paymentAddress: null,
        ordinalAddress: null,
        provider: null,
      },

      hydrateStarters: () => {
        set((state) => {
          const next = { ...state.discovered };
          for (const s of STARTERS) {
            if (!next[s.id]) next[s.id] = { ...s, discoveredAt: Date.now() };
          }
          return { discovered: next };
        });
      },

      selectForSlot: (id) => {
        const { slotA, slotB } = get();
        if (!slotA) set({ slotA: id });
        else if (!slotB && id !== slotA) set({ slotB: id });
        else if (slotA && slotB) set({ slotA: id, slotB: null });
      },

      setSlot: (slot, id) => {
        if (slot === 'A') set({ slotA: id });
        else set({ slotB: id });
      },

      clearSlots: () => set({ slotA: null, slotB: null }),

      mash: () => {
        const { slotA, slotB, discovered, recipes } = get();
        if (!slotA || !slotB || slotA === slotB) return null;
        const a = discovered[slotA];
        const b = discovered[slotB];
        if (!a || !b) return null;

        const result = mashCharacters(
          {
            id: a.id,
            name: a.name,
            generation: a.generation,
            spec: a.spec,
            origin: a.origin ?? a.demoOrigin,
          },
          {
            id: b.id,
            name: b.name,
            generation: b.generation,
            spec: b.spec,
            origin: b.origin ?? b.demoOrigin,
          },
        );

        const existingRecipe = recipes[result.recipeKey];
        if (existingRecipe && discovered[existingRecipe.childId]) {
          const child = discovered[existingRecipe.childId]!;
          set({
            lastResultId: child.id,
            lastWasNew: false,
            recipes: {
              ...recipes,
              [result.recipeKey]: {
                ...existingRecipe,
                discoveryCount: existingRecipe.discoveryCount + 1,
              },
            },
          });
          return child;
        }

        const id = childIdFromRecipe(result.recipeKey);
        if (discovered[id]) {
          set({ lastResultId: id, lastWasNew: false });
          return discovered[id]!;
        }

        const child: MashinalRecord = {
          id,
          name: result.name,
          caption: result.caption,
          generation: result.generation,
          parentAId: result.parentAId,
          parentBId: result.parentBId,
          parentAName: result.parentAName,
          parentBName: result.parentBName,
          parentAOrigin: result.parentAOrigin,
          parentBOrigin: result.parentBOrigin,
          recipeKey: result.recipeKey,
          spec: result.spec,
          discoveredAt: Date.now(),
          origin: null,
          txid: null,
          demoOrigin: null,
          svgHash: null,
          isStarter: false,
          isDiscovery: true,
        };

        set({
          discovered: { ...discovered, [id]: child },
          recipes: {
            ...recipes,
            [result.recipeKey]: {
              recipeKey: result.recipeKey,
              parentAId: result.parentAId,
              parentBId: result.parentBId,
              childId: id,
              childName: result.name,
              firstDiscoveredAt: Date.now(),
              discoveryCount: 1,
            },
          },
          lastResultId: id,
          lastWasNew: true,
        });
        return child;
      },

      markInscribed: (id, data) => {
        set((state) => {
          const rec = state.discovered[id];
          if (!rec) return state;
          const updated: MashinalRecord = data.demo
            ? {
                ...rec,
                demoOrigin: data.origin,
                svgHash: data.svgHash,
              }
            : {
                ...rec,
                origin: data.origin,
                txid: data.txid,
                demoOrigin: null,
                svgHash: data.svgHash,
              };
          return { discovered: { ...state.discovered, [id]: updated } };
        });
      },

      setWallet: (wallet) => set({ wallet }),
      disconnectWallet: () =>
        set({
          wallet: {
            connected: false,
            paymentAddress: null,
            ordinalAddress: null,
            provider: null,
          },
        }),
    }),
    {
      name: 'mashinals-v1',
      partialize: (s) => ({
        discovered: s.discovered,
        recipes: s.recipes,
        wallet: s.wallet,
      }),
    },
  ),
);

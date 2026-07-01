'use client'

import { useReducer } from 'react'
import { useConnectParcelPanel } from '@/hooks/supply-chain/use-supply-chain-mutations'
import { useStoreStore } from '@/stores/store'
import { SETUP_STEPS, STATUS_EVENTS, TRACKING_PREFS } from "@/lib/supply-chain-constants";
import { StepsRail } from './steps-rail'
import { WizardFooter } from './wizard-footer'
import { StepApiKey } from './step-api-key'
import { StepWebhook } from './step-webhook'
import { StepStatusEvents } from "./step-status-events";
import { StepTrackingPrefs } from "./step-tracking-prefs";
import { StepReview } from './step-review'
import { ConnectedScreen } from './connected-screen'

interface WizardState {
  step: number;
  apiKey: string;
  webhookToken: string | null;
  autoSync: boolean;
  statusEvents: Record<string, boolean>;
  trackingPrefs: Record<string, boolean>;
  finalized: boolean;
}

type WizardAction =
  | { type: "goTo"; step: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "setApiKey"; value: string }
  | { type: "connected"; token: string }
  | { type: "toggleAutoSync" }
  | { type: "toggleStatusEvent"; key: string }
  | { type: "toggleTrackingPref"; key: string }
  | { type: "finalize" };

const LAST_STEP = SETUP_STEPS.length - 1

const initialState: WizardState = {
  step: 0,
  apiKey: "",
  webhookToken: null,
  autoSync: true,
  statusEvents: Object.fromEntries(STATUS_EVENTS.map((e) => [e.key, e.defaultOn])),
  trackingPrefs: Object.fromEntries(TRACKING_PREFS.map((p) => [p.key, p.defaultOn])),
  finalized: false,
};

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "goTo":
      return { ...state, step: action.step, finalized: false };
    case "next":
      return { ...state, step: Math.min(state.step + 1, LAST_STEP) };
    case "prev":
      return state.finalized
        ? { ...state, finalized: false }
        : { ...state, step: Math.max(state.step - 1, 0) };
    case "setApiKey":
      return { ...state, apiKey: action.value };
    case "connected":
      return { ...state, webhookToken: action.token, step: 1 };
    case "toggleAutoSync":
      return { ...state, autoSync: !state.autoSync };
    case "toggleStatusEvent":
      return { ...state, statusEvents: { ...state.statusEvents, [action.key]: !state.statusEvents[action.key] } };
    case "toggleTrackingPref":
      return { ...state, trackingPrefs: { ...state.trackingPrefs, [action.key]: !state.trackingPrefs[action.key] } };
    case "finalize":
      return { ...state, finalized: true };
  }
}

export function SetupWizard({ onConnected }: { onConnected: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { mutate: connect, isPending, error } = useConnectParcelPanel()
  const activeStore = useStoreStore((s) => s.activeStore)
  const isLast = state.step === LAST_STEP

  const handleNext = () => {
    if (state.step === 0) {
      if (!state.apiKey.trim() || !activeStore || isPending) return
      connect(
        { apiKey: state.apiKey.trim(), storeId: activeStore.id },
        { onSuccess: (data) => dispatch({ type: 'connected', token: data.webhookToken }) },
      )
      return
    }
    if (state.finalized) {
      onConnected()
      return
    }
    if (isLast) {
      dispatch({ type: 'finalize' })
      return
    }
    dispatch({ type: 'next' })
  }

  const nextDisabled = state.step === 0 && (!state.apiKey.trim() || !activeStore || isPending)
  const nextLabel = state.finalized ? 'Go to Shipment Tracker' : isLast ? 'Connect tracker' : 'Next'

  return (
    <main className="flex min-h-screen flex-col text-foreground">
      <header className="shrink-0 px-10 pb-5 pt-6">
        <h1 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em] text-foreground">Shipment Tracker</h1>
        <p className="mt-2 text-sm text-foreground-3">Live tracking powered by Parcel Panel</p>
      </header>
      <div className="h-px shrink-0 bg-border" />

      <div className="flex min-h-0 flex-1">
        <StepsRail current={state.finalized ? SETUP_STEPS.length : state.step} onSelect={(i) => dispatch({ type: "goTo", step: i })} />
        <div className="w-px shrink-0 bg-border" />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px] px-6 pb-10 pt-11">
              {state.finalized ? (
                <ConnectedScreen />
              ) : (
                <>
                  {state.step === 0 && (
                    <StepApiKey
                      apiKey={state.apiKey}
                      onApiKeyChange={(value) => dispatch({ type: "setApiKey", value })}
                      onSubmit={handleNext}
                      error={error?.message ?? null}
                      autoSync={state.autoSync}
                      onToggleAutoSync={() => dispatch({ type: "toggleAutoSync" })}
                    />
                  )}
                  {state.step === 1 && <StepWebhook webhookToken={state.webhookToken} />}
                  {state.step === 2 && <StepStatusEvents values={state.statusEvents} onToggle={(key) => dispatch({ type: "toggleStatusEvent", key })} />}
                  {state.step === 3 && <StepTrackingPrefs values={state.trackingPrefs} onToggle={(key) => dispatch({ type: "toggleTrackingPref", key })} />}
                  {state.step === 4 && (
                    <StepReview
                      apiKey={state.apiKey}
                      webhookToken={state.webhookToken}
                      statusEvents={state.statusEvents}
                      trackingPrefs={state.trackingPrefs}
                      onEdit={(step) => dispatch({ type: "goTo", step })}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <WizardFooter
            canPrev={state.step > 0 || state.finalized}
            onPrev={() => dispatch({ type: "prev" })}
            onNext={handleNext}
            nextLabel={nextLabel}
            nextDisabled={nextDisabled}
            finalized={state.finalized}
          />
        </div>
      </div>
    </main>
  );
}

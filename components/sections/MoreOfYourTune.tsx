"use client";

import { useState, type ReactNode } from "react";
import EqualizerCard from "@/components/feat/EqualizerCard";
import SettingsCard from "@/components/feat/SettingsCard";
import PowerCard from "@/components/feat/PowerCard";
import { play } from "@/lib/audio";
import {
  CUES,
  DEFAULT_PRESET,
  DEFAULT_SETTINGS,
  PRESETS,
  SETTINGS,
  settingChip,
  type PresetId,
  type SettingKey,
  type Settings,
} from "@/lib/soundFeatures";

// More of your Tune (#sound), UPDATE_GUIDE.md section 4: three live cards with their copy, alternating sides,
// then the "also new" strip. Card state is local (nothing is saved or sent; this is a demo). Sounds go through
// play(), which already does nothing while sound is off.

const cue = (c: (typeof CUES)[keyof typeof CUES]) => play(c.name, c.volume);

type FeatRowProps = {
  /** card on the right instead of the left (phones always stack the card first) */
  rev?: boolean;
  card: ReactNode;
  label: string;
  headline: ReactNode;
  body: string;
  chips: ReactNode;
  note: string;
};

function FeatRow({ rev, card, label, headline, body, chips, note }: FeatRowProps) {
  const cardEl = <div className="fcard">{card}</div>;
  const copy = (
    <div className="fcopy">
      <div className="mono">{label}</div>
      <h3>
        {headline}
        <span className="o">.</span>
      </h3>
      <p>{body}</p>
      {/* the chips mirror the card; the card is the accessible control, so the chips stay out of the a11y tree */}
      <div className="chipset" aria-hidden="true">
        {chips}
      </div>
      <div className="trynote mono">
        <span className="ico i-info" />
        {note}
      </div>
    </div>
  );
  return (
    <div className={rev ? "feat rev" : "feat"}>
      {rev ? (
        <>
          {copy}
          {cardEl}
        </>
      ) : (
        <>
          {cardEl}
          {copy}
        </>
      )}
    </div>
  );
}

export default function MoreOfYourTune() {
  const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // from the card or a chip; picking the preset that is already on changes nothing and plays nothing
  function pickPreset(id: PresetId) {
    if (id === preset) return;
    setPreset(id);
    cue(CUES.pick);
  }

  function toggleSetting(k: SettingKey) {
    setSettings((s) => ({ ...s, [k]: !s[k] }));
    cue(CUES.toggle);
  }

  return (
    <section className="band wrap" id="sound" data-n="05" data-t="More of your Tune" aria-label="More of your Tune">
      <div className="head">
        <div>
          <div className="mono">New in hush.</div>
          <h2>
            More of your Tune, <em>one click</em> away
            <span className="o">.</span>
          </h2>
        </div>
        <p>The Equalizer, your headphone settings and power off now live in the tray too. No phone app needed.</p>
      </div>

      <FeatRow
        card={<EqualizerCard model="670" preset={preset} onPick={pickPreset} />}
        label="Equalizer"
        headline={
          <>
            Shape your <em>sound</em>
          </>
        }
        body="Six presets, one tap each. The curve sweeps across to show you exactly what changes, from the deep lows to the bright highs."
        chips={PRESETS.map((p) => (
          <span key={p.id} className={p.id === preset ? "pick on" : "pick"} onClick={() => pickPreset(p.id)}>
            {p.name}
          </span>
        ))}
        note="Try the presets on the card"
      />

      <FeatRow
        rev
        card={<SettingsCard model="670" values={settings} onToggle={toggleSetting} />}
        label="Headphone settings"
        headline={
          <>
            Your settings, <em>no phone</em>
          </>
        }
        body="Tap the gear in the tray and the settings slide up inside it. Turn on the Max Volume Limiter or switch Voice Prompt off, right from your Mac."
        chips={SETTINGS.map((s) => (
          <span key={s.k} className={settings[s.k] ? "pick on" : "pick"} onClick={() => toggleSetting(s.k)}>
            {settingChip(s.k, settings[s.k])}
          </span>
        ))}
        note="Flip the switches on the card"
      />

      <FeatRow
        card={<PowerCard model="770" onOff={() => cue(CUES.powerOff)} onCancel={() => cue(CUES.cancel)} />}
        label="Remote power off"
        headline={
          <>
            Off, <em>from your Mac</em>
          </>
        }
        body="Done for the day? Switch your headphones off with the power button in the tray. hush. asks first, so nothing happens by accident."
        chips={
          <>
            <span>770NC</span>
            <span>670NC</span>
          </>
        }
        note="Try it on the card. Nothing real gets switched off."
      />

      <div className="alsonew">
        <div>
          <span className="ico i-anc" />
          <h4>Every feature, both Tunes.</h4>
          <p>Noise control, the Equalizer, settings and power off work on the 770NC and the 670NC alike.</p>
        </div>
        <div>
          <span className="ico i-down" />
          <h4>Updates itself.</h4>
          <p>New versions arrive on their own. Nothing to download or chase.</p>
        </div>
        <div>
          <span className="ico i-info" />
          <h4>Menu bar first.</h4>
          <p>hush. opens quietly in your menu bar. No windows popping up at launch.</p>
        </div>
      </div>
    </section>
  );
}

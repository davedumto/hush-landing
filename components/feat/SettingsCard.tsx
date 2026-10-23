import { FeatFrame, SheetHead, Switch, type TuneModel } from "@/components/feat/FeatFrame";
import { SETTINGS, type SettingKey, type Settings } from "@/lib/soundFeatures";

// The Headphone Settings sheet inside the tray: the Max Volume Limiter and Voice Prompt switches. Controlled by
// the section so the chips beside the card can mirror both switches.

type SettingsCardProps = {
  model: TuneModel;
  values: Settings;
  onToggle: (k: SettingKey) => void;
};

export default function SettingsCard({ model, values, onToggle }: SettingsCardProps) {
  return (
    <FeatFrame model={model}>
      <section className="hf-sheet" aria-label="Headphone settings">
        <SheetHead title="Headphone Settings" />
        <div className="hf-set">
          {SETTINGS.map((s) => (
            <div className="hf-opt" key={s.k}>
              <span>{s.label}</span>
              <Switch label={s.label} checked={values[s.k]} onToggle={() => onToggle(s.k)} />
            </div>
          ))}
        </div>
      </section>
    </FeatFrame>
  );
}

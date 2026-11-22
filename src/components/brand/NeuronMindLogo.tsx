interface NeuronMindLogoProps {
  className?: string;
  variant?: 'emblem' | 'full';
}

export function NeuronMindLogo({
  className = 'h-9 w-9',
  variant = 'emblem',
}: NeuronMindLogoProps) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-xl bg-[#040A20] border border-blue-400/25 shadow-xs shrink-0 ${className}`}
    >
      <img
        src="/assets/aistudio/5_Ways_AI_Can_Transform_Your_Business_0b29163e.jfif"
        alt="Neuron Mind"
        className={
          variant === 'full'
            ? 'h-full w-full object-contain'
            : 'h-full w-full object-cover scale-[1.08]'
        }
      />
    </span>
  );
}

interface NeuronMindWordmarkProps {
  tone?: 'light-surface' | 'dark-surface';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function NeuronMindWordmark({
  tone = 'light-surface',
  size = 'md',
  text = 'Neuron Mind',
}: NeuronMindWordmarkProps) {
  const sizeClass =
    size === 'lg'
      ? 'text-2xl lg:text-3xl tracking-[0.06em]'
      : size === 'sm'
      ? 'text-sm tracking-[0.04em]'
      : 'text-base sm:text-lg tracking-[0.05em]';

  const colorClass =
    tone === 'dark-surface' ? 'text-white' : 'text-[#0B1B3B] dark:text-slate-100';

  return (
    <span className={`font-classic font-semibold leading-none select-none ${sizeClass} ${colorClass}`}>
      {text}
    </span>
  );
}

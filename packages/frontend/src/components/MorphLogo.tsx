interface MorphLogoProps {
  size?: number;
  className?: string;
  speed?: number; // animation duration in seconds (default 12)
}

// All 4 shapes use exactly 12 cubic bezier segments (M + 12C + Z)
// Drawn in a 100x100 viewBox, centered at 50,50

// Triangle (rounded, pointing up)
const triangle = [
  'M 50,10',
  'C 53,10 56,14 58,18',
  'C 62,25 66,32 70,39',
  'C 74,46 78,53 82,60',
  'C 86,67 90,74 90,78',
  'C 90,84 86,88 80,88',
  'C 73,88 66,88 58,88',
  'C 54,88 50,88 46,88',
  'C 42,88 38,88 30,88',
  'C 22,88 18,88 14,84',
  'C 10,80 10,74 14,67',
  'C 22,53 36,30 42,18',
  'Z',
].join(' ');

// Square (rounded)
const square = [
  'M 50,12',
  'C 58,12 66,12 74,12',
  'C 82,12 88,12 88,18',
  'C 88,26 88,34 88,42',
  'C 88,50 88,58 88,66',
  'C 88,74 88,82 88,88',
  'C 88,88 82,88 74,88',
  'C 66,88 58,88 50,88',
  'C 42,88 34,88 26,88',
  'C 18,88 12,88 12,82',
  'C 12,74 12,58 12,42',
  'C 12,26 12,18 18,12',
  'Z',
].join(' ');

// Circle (using cubic bezier approximation)
const circle = [
  'M 50,10',
  'C 56,10 62,12 67,15',
  'C 72,18 77,23 82,28',
  'C 87,33 90,39 90,45',
  'C 90,51 90,57 87,63',
  'C 84,69 79,75 73,80',
  'C 67,85 62,88 56,90',
  'C 50,92 44,90 38,87',
  'C 32,84 27,79 22,73',
  'C 17,67 13,60 11,53',
  'C 10,46 10,40 13,33',
  'C 18,22 28,14 40,10',
  'Z',
].join(' ');

// Diamond (rounded rhombus)
const diamond = [
  'M 50,8',
  'C 52,8 54,10 57,14',
  'C 60,18 64,23 68,28',
  'C 72,33 78,38 84,44',
  'C 90,48 92,50 90,54',
  'C 86,58 80,64 74,70',
  'C 68,76 62,80 57,85',
  'C 54,88 52,92 50,92',
  'C 48,92 46,88 43,85',
  'C 38,80 32,74 26,68',
  'C 20,62 14,56 10,50',
  'C 8,46 10,42 16,36',
  'Z',
].join(' ');

const pathValues = [triangle, square, circle, diamond, triangle].join('; ');

export function MorphLogo({ size = 32, className, speed = 12 }: MorphLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path fill="#D97706" d={triangle}>
        <animate
          attributeName="d"
          values={pathValues}
          keyTimes="0;0.25;0.5;0.75;1"
          dur={`${speed}s`}
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
        />
      </path>
    </svg>
  );
}

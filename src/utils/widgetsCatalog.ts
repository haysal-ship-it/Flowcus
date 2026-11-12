import { WidgetMeta } from '../types';
import widgetDimensions from './widgetDimensions.json';

export const WIDGETS_CATALOG: WidgetMeta[] = [
  {
    id: 'flowcus',
    name: 'Flowcus',
    tagline: 'Split-flap mechanical Pomodoro & daily task manager',
    category: 'Productivity',
    badgeColor: '#D05300',
    description: 'A tactile, calm productivity gadget inspired by vintage Solari split-flap departure boards. Keep track of daily goals, track focused minutes, and hear authentic mechanical clicks on every flip.',
    features: [
      'Authentic 3D split-flap mechanical countdown digits',
      'Harmonic acoustic click sounds on each second flip',
      'Daily task checklist with automated local midnight reset',
      'Progress bar with completed tasks and focus duration stats',
      'Compact floating gadget with Always-on-Top pin support',
    ],
    defaultWidth: widgetDimensions.flowcus.width,
    defaultHeight: widgetDimensions.flowcus.height,
  },
  {
    id: 'playz',
    name: 'Playz',
    tagline: 'Best-of-5 Tic-Tac-Toe with brush strokes & confetti',
    category: 'Games',
    badgeColor: '#F18A42',
    description: 'A sleek, satisfying desktop Tic-Tac-Toe arena. Features unbeatable Minimax AI, 2-player mode, organic SVG turbulence brush-stroke win lines, and burst confetti celebrations.',
    features: [
      'Best-of-5 tournament series tracker with neon scoreboards',
      'Unbeatable Minimax AI mode or Easy mode for quick breaks',
      'Authentic SVG displacement brush-stroke across winning tiles',
      'Full-canvas celebratory confetti explosions on match victory',
      'Acoustic tile click audio and celebratory win fanfare',
    ],
    defaultWidth: widgetDimensions.playz.width,
    defaultHeight: widgetDimensions.playz.height,
  },
  {
    id: 'stickk',
    name: 'Stickk',
    tagline: 'Tactile sticky note sketchpad with tearable pages',
    category: 'Utility',
    badgeColor: '#00C853',
    description: 'A fancy sticky note sketchpad for quick desktop thoughts and sketches. Switch between typing with 5 expressive funky fonts or freehand drawing with smooth multi-color ink.',
    features: [
      '5 Funky handwritten fonts: Caveat, Comic Neue, Gloria, Pacifico, Marker',
      'Smooth freehand doodle canvas with multi-color ink swatches',
      '3D curling page flip animation with stereo paper sound',
      'Realistic paper rip & tear discard animation when deleting notes',
      '5 pastel aesthetic paper themes with persistent local storage',
    ],
    defaultWidth: widgetDimensions.stickk.width,
    defaultHeight: widgetDimensions.stickk.height,
  },
];

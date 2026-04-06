import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    fontWeight: 'normal',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: 'normal',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 16,
  },
} as const;

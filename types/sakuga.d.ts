import * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sakuga-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          variant?: 'primary' | 'secondary' | string;
          disabled?: boolean;
          type?: 'button' | 'submit' | 'reset';
          part?: string;
          class?: string;
        },
        HTMLElement
      >;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'sakuga-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          variant?: 'primary' | 'secondary' | string;
          disabled?: boolean;
          type?: 'button' | 'submit' | 'reset';
          part?: string;
          class?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};

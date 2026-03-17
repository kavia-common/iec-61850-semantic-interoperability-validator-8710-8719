import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app brand', () => {
  render(<App />);
  expect(screen.getByText(/IEC 61850 SIV-Tool/i)).toBeInTheDocument();
});

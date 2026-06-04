import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Spinner, { LoadingDots } from '../../components/Spinner'

describe('Spinner', () => {
  it('renders with default md size', () => {
    const { container } = render(<Spinner />)
    expect((container.firstChild as HTMLElement).className).toContain('w-6 h-6')
  })

  it('renders with sm size', () => {
    const { container } = render(<Spinner size="sm" />)
    expect((container.firstChild as HTMLElement).className).toContain('w-4 h-4')
  })

  it('renders with lg size', () => {
    const { container } = render(<Spinner size="lg" />)
    expect((container.firstChild as HTMLElement).className).toContain('w-10 h-10')
  })

  it('forwards extra className', () => {
    const { container } = render(<Spinner className="mt-4 text-red-400" />)
    const cls = (container.firstChild as HTMLElement).className
    expect(cls).toContain('mt-4')
    expect(cls).toContain('text-red-400')
  })

  it('has animate-spin class', () => {
    const { container } = render(<Spinner />)
    expect((container.firstChild as HTMLElement).className).toContain('animate-spin')
  })

  it('has rounded-full class', () => {
    const { container } = render(<Spinner />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-full')
  })
})

describe('LoadingDots', () => {
  it('renders exactly three dot spans', () => {
    const { container } = render(<LoadingDots />)
    const dots = container.querySelectorAll('span.rounded-full')
    expect(dots).toHaveLength(3)
  })

  it('first dot has no animation delay', () => {
    const { container } = render(<LoadingDots />)
    const dots = container.querySelectorAll<HTMLElement>('span.rounded-full')
    expect(dots[0].style.animationDelay).toBe('0s')
  })

  it('second dot has 0.15s animation delay', () => {
    const { container } = render(<LoadingDots />)
    const dots = container.querySelectorAll<HTMLElement>('span.rounded-full')
    expect(dots[1].style.animationDelay).toBe('0.15s')
  })

  it('third dot has 0.3s animation delay', () => {
    const { container } = render(<LoadingDots />)
    const dots = container.querySelectorAll<HTMLElement>('span.rounded-full')
    expect(dots[2].style.animationDelay).toBe('0.3s')
  })

  it('dots have animate-bounce class', () => {
    const { container } = render(<LoadingDots />)
    const dots = container.querySelectorAll('span.rounded-full')
    dots.forEach(dot => {
      expect((dot as HTMLElement).className).toContain('animate-bounce')
    })
  })
})

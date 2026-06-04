import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from '../../components/Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Python</Badge>)
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('defaults to gray variant', () => {
    const { container } = render(<Badge>default</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-zinc-400')
  })

  it('applies blue variant classes', () => {
    const { container } = render(<Badge variant="blue">Info</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-blue-400')
  })

  it('applies green variant classes', () => {
    const { container } = render(<Badge variant="green">OK</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-emerald-400')
  })

  it('applies red variant classes', () => {
    const { container } = render(<Badge variant="red">Error</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-red-400')
  })

  it('applies yellow variant classes', () => {
    const { container } = render(<Badge variant="yellow">Warn</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-yellow-400')
  })

  it('applies purple variant classes', () => {
    const { container } = render(<Badge variant="purple">Beta</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-purple-400')
  })

  it('applies orange variant classes', () => {
    const { container } = render(<Badge variant="orange">Dep</Badge>)
    expect((container.firstChild as HTMLElement).className).toContain('text-orange-400')
  })

  it('uses sm size classes by default', () => {
    const { container } = render(<Badge>sm</Badge>)
    const cls = (container.firstChild as HTMLElement).className
    expect(cls).toContain('px-2')
    expect(cls).toContain('text-xs')
  })

  it('uses md size classes when size="md"', () => {
    const { container } = render(<Badge size="md">md</Badge>)
    const cls = (container.firstChild as HTMLElement).className
    expect(cls).toContain('px-2.5')
    expect(cls).toContain('text-sm')
  })

  it('renders status dot when dot=true', () => {
    const { container } = render(<Badge dot variant="green">online</Badge>)
    expect(container.querySelector('.bg-emerald-400')).toBeInTheDocument()
  })

  it('does not render dot when dot is omitted', () => {
    const { container } = render(<Badge variant="green">offline</Badge>)
    expect(container.querySelector('.bg-emerald-400')).not.toBeInTheDocument()
  })

  it('dot colour matches the badge variant', () => {
    const { container } = render(<Badge dot variant="red">alert</Badge>)
    expect(container.querySelector('.bg-red-400')).toBeInTheDocument()
  })

  it('renders as a span element', () => {
    render(<Badge>tag</Badge>)
    expect(screen.getByText('tag').tagName).toBe('SPAN')
  })
})

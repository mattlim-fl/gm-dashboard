import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KaraokeAvailabilityGrid } from '../KaraokeAvailabilityGrid'
import type { AvailabilitySlot } from '@/types/karaoke'

const createSlot = (
  startTime: string,
  endTime: string,
  available: boolean,
  capacities?: number[]
): AvailabilitySlot => ({
  startTime,
  endTime,
  available,
  capacities,
})

describe('KaraokeAvailabilityGrid', () => {
  const defaultProps = {
    slots: [
      createSlot('18:00', '20:00', true, [4, 8]),
      createSlot('20:00', '22:00', true, [8]),
      createSlot('22:00', '00:00', false),
    ],
    selectedStartTime: '',
    selectedEndTime: '',
    onSlotSelect: vi.fn(),
    activeHoldId: null,
    holdExpiresAt: null,
  }

  // ============================================
  // Rendering Tests
  // ============================================

  describe('rendering', () => {
    it('renders all time slots', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      expect(screen.getByText('18:00 - 20:00')).toBeInTheDocument()
      expect(screen.getByText('20:00 - 22:00')).toBeInTheDocument()
      expect(screen.getByText('22:00 - 00:00')).toBeInTheDocument()
    })

    it('renders instruction text', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      expect(screen.getByText('Select a time slot')).toBeInTheDocument()
    })

    it('shows hint when no time selected', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      expect(
        screen.getByText(/pick a date, then choose a time slot/i)
      ).toBeInTheDocument()
    })

    it('hides hint when time is selected', () => {
      render(
        <KaraokeAvailabilityGrid
          {...defaultProps}
          selectedStartTime="18:00"
          selectedEndTime="20:00"
        />
      )

      expect(
        screen.queryByText(/pick a date, then choose a time slot/i)
      ).not.toBeInTheDocument()
    })

    it('renders capacity info when available', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      expect(screen.getByText('Caps: 4, 8')).toBeInTheDocument()
      expect(screen.getByText('Caps: 8')).toBeInTheDocument()
    })

    it('does not render capacity for slots without capacities', () => {
      const slots = [createSlot('18:00', '20:00', true)]
      render(<KaraokeAvailabilityGrid {...defaultProps} slots={slots} />)

      expect(screen.queryByText(/Caps:/)).not.toBeInTheDocument()
    })
  })

  // ============================================
  // Selection State Tests
  // ============================================

  describe('selection state', () => {
    it('highlights selected slot', () => {
      render(
        <KaraokeAvailabilityGrid
          {...defaultProps}
          selectedStartTime="18:00"
          selectedEndTime="20:00"
        />
      )

      const selectedButton = screen.getByRole('button', { name: /18:00 - 20:00/i })
      expect(selectedButton).toHaveClass('bg-blue-500')
    })

    it('does not highlight unselected slots', () => {
      render(
        <KaraokeAvailabilityGrid
          {...defaultProps}
          selectedStartTime="18:00"
          selectedEndTime="20:00"
        />
      )

      const unselectedButton = screen.getByRole('button', { name: /20:00 - 22:00/i })
      expect(unselectedButton).not.toHaveClass('bg-blue-500')
      expect(unselectedButton).toHaveClass('bg-green-100')
    })
  })

  // ============================================
  // Availability State Tests
  // ============================================

  describe('availability state', () => {
    it('disables unavailable slots', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      const unavailableButton = screen.getByRole('button', { name: /22:00 - 00:00/i })
      expect(unavailableButton).toBeDisabled()
    })

    it('enables available slots', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      const availableButton = screen.getByRole('button', { name: /18:00 - 20:00/i })
      expect(availableButton).toBeEnabled()
    })

    it('styles unavailable slots with red', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      const unavailableButton = screen.getByRole('button', { name: /22:00 - 00:00/i })
      expect(unavailableButton).toHaveClass('bg-red-100')
    })

    it('styles available slots with green', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      const availableButton = screen.getByRole('button', { name: /18:00 - 20:00/i })
      expect(availableButton).toHaveClass('bg-green-100')
    })
  })

  // ============================================
  // Interaction Tests
  // ============================================

  describe('interactions', () => {
    it('calls onSlotSelect when clicking available slot', async () => {
      const user = userEvent.setup()
      const onSlotSelect = vi.fn()
      render(
        <KaraokeAvailabilityGrid {...defaultProps} onSlotSelect={onSlotSelect} />
      )

      await user.click(screen.getByRole('button', { name: /18:00 - 20:00/i }))

      expect(onSlotSelect).toHaveBeenCalledWith('18:00', '20:00')
    })

    it('calls onSlotSelect with correct times for different slots', async () => {
      const user = userEvent.setup()
      const onSlotSelect = vi.fn()
      render(
        <KaraokeAvailabilityGrid {...defaultProps} onSlotSelect={onSlotSelect} />
      )

      await user.click(screen.getByRole('button', { name: /20:00 - 22:00/i }))

      expect(onSlotSelect).toHaveBeenCalledWith('20:00', '22:00')
    })

    it('does not call onSlotSelect when clicking disabled slot', async () => {
      const user = userEvent.setup()
      const onSlotSelect = vi.fn()
      render(
        <KaraokeAvailabilityGrid {...defaultProps} onSlotSelect={onSlotSelect} />
      )

      const unavailableButton = screen.getByRole('button', { name: /22:00 - 00:00/i })
      await user.click(unavailableButton)

      expect(onSlotSelect).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // Hold State Tests
  // ============================================

  describe('hold state', () => {
    it('shows hold message when activeHoldId and holdExpiresAt are set', () => {
      const holdExpiresAt = new Date(Date.now() + 300000).toISOString() // 5 min from now
      render(
        <KaraokeAvailabilityGrid
          {...defaultProps}
          activeHoldId="hold-123"
          holdExpiresAt={holdExpiresAt}
        />
      )

      expect(screen.getByText(/hold created/i)).toBeInTheDocument()
      expect(screen.getByText(/expires at/i)).toBeInTheDocument()
    })

    it('does not show hold message when no active hold', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} />)

      expect(screen.queryByText(/hold created/i)).not.toBeInTheDocument()
    })

    it('does not show hold message when holdExpiresAt is missing', () => {
      render(
        <KaraokeAvailabilityGrid
          {...defaultProps}
          activeHoldId="hold-123"
          holdExpiresAt={null}
        />
      )

      expect(screen.queryByText(/hold created/i)).not.toBeInTheDocument()
    })

    it('does not show hold message when activeHoldId is missing', () => {
      const holdExpiresAt = new Date(Date.now() + 300000).toISOString()
      render(
        <KaraokeAvailabilityGrid
          {...defaultProps}
          activeHoldId={null}
          holdExpiresAt={holdExpiresAt}
        />
      )

      expect(screen.queryByText(/hold created/i)).not.toBeInTheDocument()
    })
  })

  // ============================================
  // Edge Cases
  // ============================================

  describe('edge cases', () => {
    it('renders empty state when no slots provided', () => {
      render(<KaraokeAvailabilityGrid {...defaultProps} slots={[]} />)

      expect(screen.getByText('Select a time slot')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('handles single slot', () => {
      const slots = [createSlot('18:00', '20:00', true)]
      render(<KaraokeAvailabilityGrid {...defaultProps} slots={slots} />)

      expect(screen.getByRole('button', { name: /18:00 - 20:00/i })).toBeInTheDocument()
    })

    it('handles all unavailable slots', () => {
      const slots = [
        createSlot('18:00', '20:00', false),
        createSlot('20:00', '22:00', false),
      ]
      render(<KaraokeAvailabilityGrid {...defaultProps} slots={slots} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    it('handles empty capacities array', () => {
      const slots = [createSlot('18:00', '20:00', true, [])]
      render(<KaraokeAvailabilityGrid {...defaultProps} slots={slots} />)

      expect(screen.queryByText(/Caps:/)).not.toBeInTheDocument()
    })
  })
})

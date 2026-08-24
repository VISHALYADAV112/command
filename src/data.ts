import { addDays, dateKey, startOfMonday } from './domain'
import type { CommandData } from './types'

export function createDemoData(now = new Date()): CommandData {
  const monday = startOfMonday(now)
  const today = dateKey(now)
  const logDays = [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDays(monday, offset))
    .filter((day) => day <= now)

  const patterns = [
    [30, 90, 30, 60],
    [45, 120, 45, 75],
    [30, 75, 30, 45],
    [60, 135, 30, 60],
    [30, 120, 60, 90],
    [75, 150, 45, 60],
    [30, 90, 30, 60],
  ]

  return {
    logs: logDays.map((day, index) => {
      const [nodeMinutes, dsaMinutes, mathMinutes, jobMinutes] = patterns[index]
      const isToday = dateKey(day) === today
      return {
        day: dateKey(day),
        meditation: !isToday || index % 2 === 0,
        gym: !isToday && index % 3 !== 1,
        diet: isToday ? null : index % 4 === 2 ? 'loose' : 'on_track',
        nodeMinutes: isToday ? 30 : nodeMinutes,
        dsaMinutes: isToday ? 75 : dsaMinutes,
        mathMinutes: isToday ? 15 : mathMinutes,
        jobMinutes: isToday ? 0 : jobMinutes,
        note: '',
      }
    }),
    applications: [
      {
        id: 'app-1',
        company: 'Atlassian',
        role: 'Graduate Software Engineer',
        lane: 'sde',
        channel: 'india_product',
        status: 'researching',
        windowClosesOn: dateKey(addDays(now, 8)),
        followUpOn: dateKey(addDays(now, 1)),
        ctcLpa: null,
        referrerId: 'person-1',
        jobUrl: '',
        nextAction: 'Ask for referral, then tailor resume',
      },
      {
        id: 'app-2',
        company: 'Razorpay',
        role: 'Software Engineer — Backend',
        lane: 'sde',
        channel: 'gcc',
        status: 'applied',
        windowClosesOn: null,
        followUpOn: dateKey(now),
        ctcLpa: 24,
        referrerId: null,
        jobUrl: '',
        nextAction: 'Follow up with campus recruiter',
      },
      {
        id: 'app-3',
        company: 'Sarvam AI',
        role: 'ML Engineer Intern',
        lane: 'ai_ml',
        channel: 'remote_intl',
        status: 'oa',
        windowClosesOn: null,
        followUpOn: dateKey(addDays(now, 3)),
        ctcLpa: null,
        referrerId: null,
        jobUrl: '',
        nextAction: 'Complete evaluation by Friday',
      },
    ],
    people: [
      {
        id: 'person-1',
        name: 'Ananya Rao',
        company: 'Atlassian',
        status: 'to_reach_out',
        nextFollowUpOn: dateKey(now),
      },
      {
        id: 'person-2',
        name: 'Kabir Mehta',
        company: 'Razorpay',
        status: 'talking',
        nextFollowUpOn: dateKey(addDays(now, 2)),
      },
    ],
    projects: [
      {
        id: 'project-1',
        name: 'RAG evaluation workbench',
        type: 'portfolio',
        status: 'active',
        deadlineOn: dateKey(addDays(now, 5)),
        nextAction: 'Publish baseline metrics and README',
      },
      {
        id: 'project-2',
        name: 'Client document classifier',
        type: 'freelance',
        status: 'blocked',
        deadlineOn: dateKey(addDays(now, 2)),
        nextAction: 'Get labelled samples from client',
      },
    ],
    ideas: [
      {
        id: 'idea-1',
        idea: 'Placement-prep spaced-repetition shell for Indian colleges',
        status: 'captured',
        nextAction: 'Ask three seniors if they would pay',
      },
      {
        id: 'idea-2',
        idea: 'Weekly auto-digest of GCC roles for freshers',
        status: 'exploring',
        nextAction: 'Draft the scrape-and-rank pipeline',
      },
    ],
    learning: [
      {
        id: 'learn-1',
        concept: 'Sliding window: variable size',
        track: 'dsa',
        itemType: 'pattern',
        confidence: 2,
        nextReviewOn: dateKey(now),
        masteryHits: 0,
        content: 'Expand the right edge, then shrink from the left while the constraint is violated. Track the best valid window after restoring the invariant.',
      },
      {
        id: 'learn-2',
        concept: 'Node event-loop phases',
        track: 'node',
        itemType: 'concept',
        confidence: 3,
        nextReviewOn: dateKey(addDays(now, -1)),
        masteryHits: 0,
        content: 'Timers, pending callbacks, idle/prepare, poll, check, then close callbacks. Promise microtasks run between operations; process.nextTick has its own priority queue.',
      },
      {
        id: 'learn-3',
        concept: 'Bayes theorem from conditional probability',
        track: 'math',
        itemType: 'formula',
        confidence: 4,
        nextReviewOn: dateKey(now),
        masteryHits: 1,
        content: 'P(A|B) = P(B|A)P(A) / P(B). The denominator normalizes the likelihood-weighted prior over all possible causes.',
      },
    ],
  }
}

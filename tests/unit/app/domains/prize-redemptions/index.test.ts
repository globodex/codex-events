import { describe, expect, test } from 'vitest'

import {
  buildPrizeRedemptionOperationsView,
  type PrizeRedemptionTask
} from '../../../../../app/domains/prize-redemptions'

function createTask(overrides?: Partial<PrizeRedemptionTask>): PrizeRedemptionTask {
  return {
    id: 'redemption_1',
    status: 'pending',
    userId: null,
    teamId: 'team_1',
    legalName: null,
    winnerTermsDocumentId: null,
    winnerTermsAcceptedAt: null,
    redeemedAt: null,
    createdAt: '2026-03-23T12:00:00.000Z',
    updatedAt: '2026-03-23T12:00:00.000Z',
    prize: {
      id: 'prize_1',
      eventId: 'event_1',
      name: 'Fixture Prize',
      description: 'Fixture prize description',
      rewardType: 'api_credits',
      rewardValue: '1000',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1,
      displayOrder: 0,
      createdAt: '2026-03-23T12:00:00.000Z'
    },
    event: {
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      state: 'winners_announced',
      currentWinnerTermsDocumentId: 'terms_winner_1'
    },
    currentWinnerTerms: {
      id: 'terms_winner_1',
      eventId: 'event_1',
      documentType: 'winner_terms',
      version: 2,
      title: 'Winner Terms',
      content: 'Fixture winner terms',
      publishedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z'
    },
    ...overrides
  }
}

describe('prize-redemption workspace helpers', () => {
  test('groups winners into one ordered list and separates non-winning finalists from the rest of the ranking', () => {
    const winners = [
      {
        teamId: 'team_1',
        teamName: 'Alpha Team',
        submissionId: 'submission_1',
        projectName: 'Alpha Project',
        summary: null,
        repositoryUrl: null,
        demoUrl: null,
        finalRank: 1,
        prizes: [
          {
            ...createTask().prize,
            id: 'prize_rank_1',
            name: '1st Place API Credits',
            rankStart: 1,
            rankEnd: 1
          },
          {
            ...createTask().prize,
            id: 'prize_top_5',
            name: 'Top 5 Teams Member Benefit',
            rewardType: 'subscription',
            rewardValue: '1 year ChatGPT Pro',
            rewardCurrency: null,
            awardScope: 'member',
            rankStart: 1,
            rankEnd: 5
          }
        ],
        teamMembers: [
          {
            id: 'user_1',
            fullName: 'Winner Member One',
            bio: null,
            xProfileUrl: null,
            linkedinProfileUrl: null,
            githubProfileUrl: null,
            profileIconUrl: null
          }
        ]
      },
      {
        teamId: 'team_4',
        teamName: 'Delta Team',
        submissionId: 'submission_4',
        projectName: 'Delta Project',
        summary: null,
        repositoryUrl: null,
        demoUrl: null,
        finalRank: 4,
        prizes: [
          {
            ...createTask().prize,
            id: 'prize_top_5',
            name: 'Top 5 Teams Member Benefit',
            rewardType: 'subscription',
            rewardValue: '1 year ChatGPT Pro',
            rewardCurrency: null,
            awardScope: 'member',
            rankStart: 1,
            rankEnd: 5
          }
        ],
        teamMembers: [
          {
            id: 'user_4',
            fullName: 'Winner Member Four',
            bio: null,
            xProfileUrl: null,
            linkedinProfileUrl: null,
            githubProfileUrl: null,
            profileIconUrl: null
          }
        ]
      },
      {
        teamId: 'team_5',
        teamName: 'Epsilon Team',
        submissionId: 'submission_5',
        projectName: 'Epsilon Project',
        summary: null,
        repositoryUrl: null,
        demoUrl: null,
        finalRank: 5,
        prizes: [
          {
            ...createTask().prize,
            id: 'prize_top_5',
            name: 'Top 5 Teams Member Benefit',
            rewardType: 'subscription',
            rewardValue: '1 year ChatGPT Pro',
            rewardCurrency: null,
            awardScope: 'member',
            rankStart: 1,
            rankEnd: 5
          }
        ],
        teamMembers: [
          {
            id: 'user_5',
            fullName: 'Winner Member Five',
            bio: null,
            xProfileUrl: null,
            linkedinProfileUrl: null,
            githubProfileUrl: null,
            profileIconUrl: null
          }
        ]
      },
      {
        teamId: 'team_2',
        teamName: 'Beta Team',
        submissionId: 'submission_2',
        projectName: 'Beta Project',
        summary: null,
        repositoryUrl: null,
        demoUrl: null,
        finalRank: 2,
        prizes: [
          {
            ...createTask().prize,
            id: 'prize_rank_2',
            name: '2nd Place API Credits',
            rankStart: 2,
            rankEnd: 2
          },
          {
            ...createTask().prize,
            id: 'prize_top_5',
            name: 'Top 5 Teams Member Benefit',
            rewardType: 'subscription',
            rewardValue: '1 year ChatGPT Pro',
            rewardCurrency: null,
            awardScope: 'member',
            rankStart: 1,
            rankEnd: 5
          }
        ],
        teamMembers: [
          {
            id: 'user_2',
            fullName: 'Winner Member Two',
            bio: null,
            xProfileUrl: null,
            linkedinProfileUrl: null,
            githubProfileUrl: null,
            profileIconUrl: null
          }
        ]
      }
    ]

    const redemptions = [
      createTask({
        id: 'redemption_rank_1',
        prize: {
          ...createTask().prize,
          id: 'prize_rank_1',
          name: '1st Place API Credits',
          rankStart: 1,
          rankEnd: 1
        }
      }),
      createTask({
        id: 'redemption_rank_2',
        teamId: 'team_2',
        prize: {
          ...createTask().prize,
          id: 'prize_rank_2',
          name: '2nd Place API Credits',
          rankStart: 2,
          rankEnd: 2
        }
      }),
      createTask({
        id: 'redemption_member_1',
        userId: 'user_1',
        prize: {
          ...createTask().prize,
          id: 'prize_top_5',
          name: 'Top 5 Teams Member Benefit',
          rewardType: 'subscription',
          rewardValue: '1 year ChatGPT Pro',
          rewardCurrency: null,
          awardScope: 'member',
          rankStart: 1,
          rankEnd: 5
        }
      }),
      createTask({
        id: 'redemption_member_2',
        status: 'redeemed',
        userId: 'user_2',
        teamId: 'team_2',
        legalName: 'Winner Member Two',
        prize: {
          ...createTask().prize,
          id: 'prize_top_5',
          name: 'Top 5 Teams Member Benefit',
          rewardType: 'subscription',
          rewardValue: '1 year ChatGPT Pro',
          rewardCurrency: null,
          awardScope: 'member',
          rankStart: 1,
          rankEnd: 5
        }
      }),
      createTask({
        id: 'redemption_member_4',
        userId: 'user_4',
        teamId: 'team_4',
        prize: {
          ...createTask().prize,
          id: 'prize_top_5',
          name: 'Top 5 Teams Member Benefit',
          rewardType: 'subscription',
          rewardValue: '1 year ChatGPT Pro',
          rewardCurrency: null,
          awardScope: 'member',
          rankStart: 1,
          rankEnd: 5
        }
      }),
      createTask({
        id: 'redemption_member_5',
        status: 'redeemed',
        userId: 'user_5',
        teamId: 'team_5',
        legalName: 'Winner Member Five',
        prize: {
          ...createTask().prize,
          id: 'prize_top_5',
          name: 'Top 5 Teams Member Benefit',
          rewardType: 'subscription',
          rewardValue: '1 year ChatGPT Pro',
          rewardCurrency: null,
          awardScope: 'member',
          rankStart: 1,
          rankEnd: 5
        }
      })
    ]

    const finalRankingEntries = [
      {
        teamId: 'team_1',
        teamName: 'Alpha Team',
        submissionId: 'submission_1',
        projectName: 'Alpha Project',
        summary: 'Alpha summary',
        repositoryUrl: 'https://example.com/alpha',
        demoUrl: 'https://example.com/alpha-demo',
        finalRank: 1,
        teamMembers: []
      },
      {
        teamId: 'team_2',
        teamName: 'Beta Team',
        submissionId: 'submission_2',
        projectName: 'Beta Project',
        summary: 'Beta summary',
        repositoryUrl: 'https://example.com/beta',
        demoUrl: 'https://example.com/beta-demo',
        finalRank: 2,
        teamMembers: []
      },
      {
        teamId: 'team_3',
        teamName: 'Gamma Team',
        submissionId: 'submission_3',
        projectName: 'Gamma Project',
        summary: 'Gamma summary',
        repositoryUrl: 'https://example.com/gamma',
        demoUrl: 'https://example.com/gamma-demo',
        finalRank: 3,
        teamMembers: []
      },
      {
        teamId: 'team_4',
        teamName: 'Delta Team',
        submissionId: 'submission_4',
        projectName: 'Delta Project',
        summary: 'Delta summary',
        repositoryUrl: 'https://example.com/delta',
        demoUrl: 'https://example.com/delta-demo',
        finalRank: 4,
        teamMembers: []
      },
      {
        teamId: 'team_5',
        teamName: 'Epsilon Team',
        submissionId: 'submission_5',
        projectName: 'Epsilon Project',
        summary: 'Epsilon summary',
        repositoryUrl: 'https://example.com/epsilon',
        demoUrl: 'https://example.com/epsilon-demo',
        finalRank: 5,
        teamMembers: []
      },
      {
        teamId: 'team_6',
        teamName: 'Zeta Team',
        submissionId: 'submission_6',
        projectName: 'Zeta Project',
        summary: 'Zeta summary',
        repositoryUrl: 'https://example.com/zeta',
        demoUrl: 'https://example.com/zeta-demo',
        finalRank: 6,
        teamMembers: []
      }
    ]

    expect(buildPrizeRedemptionOperationsView(winners, redemptions, finalRankingEntries)).toEqual({
      winnerItems: [
        expect.objectContaining({
          winner: expect.objectContaining({ teamName: 'Alpha Team', finalRank: 1 }),
          prizes: [
            expect.objectContaining({ id: 'prize_rank_1' }),
            expect.objectContaining({ id: 'prize_top_5' })
          ],
          pendingCount: 2,
          redeemedCount: 0,
          totalCount: 2
        }),
        expect.objectContaining({
          winner: expect.objectContaining({ teamName: 'Beta Team', finalRank: 2 }),
          prizes: [
            expect.objectContaining({ id: 'prize_rank_2' }),
            expect.objectContaining({ id: 'prize_top_5' })
          ],
          pendingCount: 1,
          redeemedCount: 1,
          totalCount: 2
        }),
        expect.objectContaining({
          winner: expect.objectContaining({ teamName: 'Delta Team', finalRank: 4 }),
          prizes: [expect.objectContaining({ id: 'prize_top_5' })],
          pendingCount: 1,
          redeemedCount: 0,
          totalCount: 1
        }),
        expect.objectContaining({
          winner: expect.objectContaining({ teamName: 'Epsilon Team', finalRank: 5 }),
          prizes: [expect.objectContaining({ id: 'prize_top_5' })],
          pendingCount: 0,
          redeemedCount: 1,
          totalCount: 1
        })
      ],
      shortlistedEntries: [
        expect.objectContaining({
          teamName: 'Gamma Team',
          submissionId: 'submission_3',
          finalRank: 3
        }),
        expect.objectContaining({
          teamName: 'Zeta Team',
          submissionId: 'submission_6',
          finalRank: 6
        })
      ]
    })
  })
})

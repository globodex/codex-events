import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'

const meta = {
  title: 'Primitives/Card',
  component: Card
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const WithAction: Story = {
  render: () => ({
    components: { Button, Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle },
    template: `
      <Card class="max-w-sm">
        <CardHeader>
          <CardTitle>Build a command-line tool</CardTitle>
          <CardDescription>10:30–11:15 · Room B</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" type="button">Save</Button>
          </CardAction>
        </CardHeader>
        <CardContent>Bring your laptop and a project idea.</CardContent>
        <CardFooter>Workshop</CardFooter>
      </Card>
    `
  })
}

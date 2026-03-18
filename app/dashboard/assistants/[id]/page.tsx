import { AssistantDetailClientFull } from './AssistantDetailClientFull'

export default async function ViewPassengerAssistantPage({
  params,
}: {
  params: { id: string }
}) {
  return <AssistantDetailClientFull id={params.id} />
}


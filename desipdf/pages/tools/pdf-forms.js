export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/tools/edit-pdf',
      permanent: true,
    },
  }
}

export default function Page() {
  return null
}

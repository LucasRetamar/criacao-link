const createClient = require("redis").createClient
module.exports = class RedisDB {
  #client
  async connect() {
    const client = await createClient({
      socket: {
        host: "172.16.0.202",
        port: "6379",
      },
      password: "senh@redis",
    })
      .on("error", err => {
        console.log("Não foi possível conectar ao Redis", err)
      })
      .on("connect", () => {
        console.log("Conectado ao Redis com sucesso!")
      })
      .connect()

    return (this.#client = client)
  }

  async setClient(nameClient, idCliente) {
    await this.#client.select("4")
    await this.#client.set(nameClient, String(idCliente).padStart(4, "0"), {
      EX: 86400,
    })
    console.log(
      `Chave Redis definida para o idCliente: ${idCliente} | cliente: ${nameClient}`
    )

    return true
  }

  async setClientVerify(nameClient, idCliente) {
    await this.#client.select("6")
    await this.#client.set(nameClient, idCliente)
    console.log(
      `Chave Redis V2 definida para o idCliente: ${idCliente} | cliente: ${nameClient}`
    )

    return true
  }
}
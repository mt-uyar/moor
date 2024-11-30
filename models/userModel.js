class User {
    constructor(userId, userName, fullName, email, password, active, createdAt, updatedAt) {
      this.userId = userId;
      this.userName = userName;
      this.fullName = fullName;
      this.email = email;
      this.password = password;
      this.active = active;
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
    }
} 

module.exports = User;
